# ruff: noqa: E402 (truststore.inject_into_ssl() precisa vir antes dos demais imports)
import asyncio
import logging
from contextlib import asynccontextmanager

import truststore

# Confia no repositório de certificados do SO, que tem a Morlan-CA emissora do
# Keycloak (*.aws.morlan.local) junto das CAs públicas. Precisa rodar antes de
# qualquer conexão HTTPS. No contêiner a CA é instalada pelo Dockerfile
# (update-ca-certificates).
truststore.inject_into_ssl()

from dh_helper.fastapi.auto_router import discover_routers
from dh_helper.obslog.config import LogConfig
from dh_helper.obslog.setup import configure as configure_logging
from dh_helper.obslog.setup import shutdown as shutdown_logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from morlan_access import BffAuthConfig, create_auth_router
from morlan_access import configure as configure_auth

from app.config import settings
from app.db import catalog_db
from app.db.auth_engine import auth_engine, get_auth_db
from app.features.auth.dev_bypass import install_dev_bypass
from app.features.schemas.service import list_schemas

configure_logging(
    LogConfig(
        stdout_level=settings.LOG_LEVEL,
        # Reaproveita o mesmo engine síncrono da sessão de auth do
        # morlan_access (ver app/db/auth_engine.py) — dh_helper.obslog só
        # precisa de um `sqlalchemy.Engine` comum, sem motivo para manter um
        # segundo pool de conexões para a mesma Postgres só por isso.
        # `create_engine()` é lazy, então isso nunca bloqueia/falha no
        # momento do import mesmo que o banco esteja fora do ar;
        # `configure_logging()` em si também nunca levanta exceção (recai
        # para stdout-only em qualquer falha interna), e o DbBatchHandler só
        # toca o banco no primeiro flush de fato, a partir da própria thread
        # em background — então uma conexão ruim aqui só aparece como um
        # aviso no stderr, nunca como um crash na inicialização.
        engine=auth_engine if settings.LOG_DB_ENABLED else None,
        db_min_level=settings.LOG_DB_MIN_LEVEL,
        # db_schema/db_table ficam no default do próprio LogConfig
        # (cur_tin.log_exec_web, padronizado pela organização — ver
        # app/config.py) — não passados aqui de propósito. app_name
        # identifica, na coluna de app, qual app escreveu cada linha; é
        # configurado uma única vez aqui, não em cada chamada de
        # logger.<method>().
        app_name=settings.APP_NAME,
        batch_size=settings.LOG_DB_BATCH_SIZE,
        flush_interval_seconds=settings.LOG_DB_FLUSH_INTERVAL_SECONDS,
    )
)

logger = logging.getLogger(__name__)

configure_auth(
    BffAuthConfig(
        keycloak_issuer=settings.KEYCLOAK_ISSUER,
        client_id=settings.KEYCLOAK_CLIENT_ID,
        client_secret=settings.KEYCLOAK_CLIENT_SECRET,
        redirect_uri=settings.OIDC_REDIRECT_URI,
        frontend_url=settings.FRONTEND_URL,
        internal_issuer=settings.OIDC_INTERNAL_ISSUER,
        session_secret=settings.SESSION_SECRET,
        cookie_secure=settings.COOKIE_SECURE,
        cookie_samesite=settings.COOKIE_SAMESITE,
        session_store=settings.SESSION_STORE,
        session_redis_host=settings.SESSION_REDIS_HOST,
        session_redis_port=settings.SESSION_REDIS_PORT,
        session_redis_db=settings.SESSION_REDIS_DB,
        session_redis_tls=settings.SESSION_REDIS_TLS,
        session_redis_auth=settings.SESSION_REDIS_AUTH,
        # Nível 3 (funcionalidades) — em branco por padrão; preencha
        # MORLAN_ACCESS_API_URL/MORLAN_ACCESS_SISTEMA (.env) e veja o README
        # de morlan-access-lib (§ Autorização) para habilitar
        # AccessApiClient/requer_funcionalidade. Deliberadamente fora deste
        # template (mesmo raciocínio do RBAC do lado do front).
        access_api_base_url=settings.MORLAN_ACCESS_API_URL,
        access_api_sistema=settings.MORLAN_ACCESS_SISTEMA,
        # Em branco por padrão — ver KEYCLOAK_EXTRA_CLAIMS em app/config.py.
        extra_claims=settings.KEYCLOAK_EXTRA_CLAIMS,
    )
)


async def _esquentar_catalogo() -> None:
    """Abre a conexão do catálogo e já carrega a lista de schemas (a primeira
    tela de qualquer usuário), para ninguém pagar a partida a frio. Em
    segundo plano e sem nunca derrubar o app."""
    await catalog_db.warm_up()
    try:
        await list_schemas()
    except Exception:
        logger.warning("Não foi possível pré-carregar os schemas", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    warm_up = asyncio.create_task(_esquentar_catalogo())
    yield
    warm_up.cancel()
    shutdown_logging()


app = FastAPI(
    title="WGOV0001 Catálogo de Dados API", version="0.1.0", lifespan=lifespan
)


@app.exception_handler(catalog_db.CatalogPermissionError)
async def catalog_permission_handler(
    request: Request, exc: catalog_db.CatalogPermissionError
) -> JSONResponse:
    """Tabela que o usuário do banco não lê: 403 claro, não 500."""
    logger.warning("Leitura negada em %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Última linha de defesa: qualquer exceção não tratada é logada com
    stack trace completo e devolvida ao cliente de forma sanitizada — nunca
    vaza traceback na resposta. `HTTPException`s não passam por aqui
    (Starlette já tem handler próprio para elas, com precedência)."""
    logger.exception("Erro não tratado em %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Erro interno do servidor"})


# Localhost só entra no whitelist quando DEBUG=True — em produção, a origem
# aceita é apenas FRONTEND_URL.
_allowed_origins = [settings.FRONTEND_URL]
if settings.DEBUG:
    _allowed_origins.append("http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Só desenvolvimento local (Settings recusa DEV_AUTH_BYPASS sem DEBUG=True).
# Precisa vir ANTES do router de auth abaixo: o `/api/auth/me` simulado tem de
# casar primeiro.
if settings.DEV_AUTH_BYPASS:
    install_dev_bypass(app)

# `create_auth_router` recebe `get_auth_db` (síncrono) — não `get_db`
# (assíncrono, usado pelas features de negócio) — ver
# app/db/auth_engine.py para o porquê. Router já vem com prefix="/api/auth"
# fixo na própria lib.
app.include_router(create_auth_router(get_auth_db))

# `/api` — mesmo prefixo do router de auth acima (`/api/auth`, fixo na lib)
# e do que `src/lib/api.ts`/`VITE_API_URL` esperam do outro lado do proxy
# (vite.config.ts em dev, nginx.conf em prod). Aplicado aqui, uma vez, em
# vez de cada feature repetir "/api" no próprio APIRouter(prefix=...).
for router in discover_routers(__file__):
    app.include_router(router, prefix="/api")
