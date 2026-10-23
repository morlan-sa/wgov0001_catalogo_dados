from typing import Annotated, Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode

# Mesmo par usado por rnc2/server (app/config.py's SECRET_KEY) — lá é a
# chave de assinatura de um token à parte deste app; aqui é o próprio
# `SESSION_SECRET` que assina a sessão BFF (ver BffAuthConfig em
# app/main.py), então a checagem abaixo mira nele diretamente.
_MIN_SESSION_SECRET_LENGTH = 32
_MAX_APP_NAME_LENGTH = 20


class Settings(BaseSettings):
    # Aceita DATABASE_URL direto OU o contrato da esteira (DATABASE_HOST/PORT/NAME +
    # DATABASE_USER/DATABASE_PASSWORD do secret).
    # Nesse caso a URL é montada no validator abaixo.
    DATABASE_URL: str = ""
    DATABASE_HOST: str = ""
    DATABASE_PORT: str = "5432"
    DATABASE_NAME: str = ""
    DATABASE_USER: str = ""
    DATABASE_PASSWORD: str = ""
    # A mesma Postgres é compartilhada por todos os apps Morlan — não há
    # instância dedicada por projeto. Isolamento é por schema, não por
    # database (mesmo raciocínio do `cur_qua` em rnc2/server): toda tabela
    # de negócio deste app vive sob este schema. `cur_tin.log_exec_web` é
    # uma exceção — ver LOG_DB_ENABLED abaixo, é uma tabela compartilhada
    # entre apps, não deste schema. Sem default de propósito — mas o valor
    # não é escolhido por app: é o nome do domínio de negócio a que as
    # tabelas deste app pertencem. Apps que mexem em tabelas do mesmo
    # domínio de negócio compartilham o mesmo schema entre si, não usam um
    # schema exclusivo por app dentro do domínio. Pergunte qual é esse
    # domínio a quem está configurando o projeto, em vez de derivá-lo do
    # nome do repositório.
    DATABASE_SCHEMA: str
    # Schema onde mora a tabela `sessao` de `morlan_access` (modo
    # `SESSION_STORE=rds` abaixo) — `cur_iam`, o schema da própria Morlan
    # Access/IAM, não `DATABASE_SCHEMA` deste app. `morlan_access.models.
    # Sessao` não declara `schema=` próprio (é modelo da lib, não nosso, pra
    # mudar), então quem resolve isso é o `search_path` da conexão síncrona
    # em `app/db/auth_engine.py` — ver lá.
    IAM_SCHEMA: str
    # DEBUG habilita comportamentos de desenvolvimento: cookie de sessão sem
    # Secure e CORS aberto para localhost:5173. Deve permanecer False em
    # produção.
    DEBUG: bool = False
    # Só para desenvolvimento local: pula o gate ACESSO_APP (access_gate.py)
    # enquanto o client Keycloak do app não está em TRUSTED_SERVICE_CLIENTS da
    # Morlan Access (a Access API responde 403 e o gate nega todo mundo). Só
    # vale com DEBUG=True; com DEBUG=False é ignorado (gate ativo).
    ACCESS_GATE_DISABLED: bool = False
    # Só para desenvolvimento local, sem Keycloak: toda requisição passa a ser
    # de um usuário simulado (DEV_USER_*), sem login, sessão nem gate de
    # acesso. Exige DEBUG=True — com DEBUG=False o Settings recusa subir
    # (fail-closed), então não há como ligar isto em produção por engano.
    DEV_AUTH_BYPASS: bool = False
    DEV_USER_CODIGO: str = "dev.local"
    DEV_USER_NOME: str = "Usuário de Desenvolvimento"
    DEV_USER_EMAIL: str = "dev.local@example.com"
    DEV_USER_ROLES: Annotated[tuple[str, ...], NoDecode] = ("dev",)

    FRONTEND_URL: str

    # Keycloak/OIDC — BFF via morlan-access-lib (ver app/main.py:
    # configure(BffAuthConfig(...))). A lib nunca lê env var diretamente;
    # este é o único lugar do app que sabe desses nomes.
    KEYCLOAK_ISSUER: str
    KEYCLOAK_CLIENT_ID: str
    KEYCLOAK_CLIENT_SECRET: str
    OIDC_REDIRECT_URI: str

    # Claims extras do token do Keycloak a repassar pra frente (ex.:
    # "departmentNumber" ou "departmentNumber,employeeType") — em branco por
    # padrão.
    KEYCLOAK_EXTRA_CLAIMS: Annotated[tuple[str, ...], NoDecode] = ()
    # Base interna de discovery quando difere da pública (ex.: Keycloak
    # acessado por um hostname interno do Docker) — deixe em branco se não
    # houver essa diferença.
    OIDC_INTERNAL_ISSUER: str = ""
    SESSION_SECRET: str
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    # Store de sessão server-side da lib (session_store.py) — "rds" (default,
    # tabela `sessao` em IAM_SCHEMA acima) ou "redis" (golden path em prod,
    # Amazon ElastiCache — fail-closed: Redis fora do ar = sessão não
    # resolvida, nunca 500). Este template roda em "rds" hoje (o pacote
    # `redis` nem está instalado — ver pyproject.toml); mudar pra "redis"
    # exige reinstalar essa dependência antes. Com "redis", SESSION_REDIS_HOST
    # é obrigatório (os demais têm default sensato).
    SESSION_STORE: str = "rds"
    SESSION_REDIS_HOST: str = ""
    SESSION_REDIS_PORT: int = 6379
    SESSION_REDIS_DB: int = 0
    SESSION_REDIS_TLS: bool = True
    SESSION_REDIS_AUTH: str = ""

    # Nível 3 (funcionalidades, opcional) — deixe em branco para não usar.
    MORLAN_ACCESS_API_URL: str = ""
    MORLAN_ACCESS_SISTEMA: str = ""

    # Fonte dos metadados do catálogo: "db2" (SYSCAT.*, via app/db/db2.py) ou
    # "postgres" (pg_catalog, no mesmo Postgres configurado em DATABASE_*).
    # Em ambos os casos a leitura é SOMENTE LEITURA — o catálogo não grava
    # nada, nem na fonte nem em tabela própria (ver app/db/catalog_db.py).
    CATALOG_SOURCE: Literal["db2", "postgres"] = "db2"

    # DB2 — só exigido com CATALOG_SOURCE=db2. Sem default de propósito para
    # usuário e senha, como o resto das credenciais — digitados pela pessoa no
    # `.env` (ou vindos do Secrets Manager).
    DB2_HOST: str = ""
    DB2_PORT: int = 0
    DB2_DATABASE: str = ""
    DB2_USER: str = ""
    DB2_PASSWORD: str = ""
    # O driver CLI negocia a codepage do cliente na conexão; sem 1208 (UTF-8)
    # os acentos de REMARKS chegam como U+FFFD.
    DB2_CODEPAGE: str = "1208"
    # SQL5005C aparece de forma intermitente sob muita abertura/fechamento
    # simultâneo de conexões — uma única nova tentativa, após este intervalo,
    # resolve. Qualquer outro erro não é repetido.
    DB2_CONNECT_RETRY_DELAY_SECONDS: float = 0.2

    # Catálogo — limites e política de saúde dos dados.
    CATALOG_COLUMN_SEARCH_LIMIT: int = 200
    # Classificação da completude: >= EXCELENTE → Excelente; >= BOM → Bom;
    # abaixo disso → Atenção.
    COMPLETUDE_LIMIAR_EXCELENTE: int = 90
    COMPLETUDE_LIMIAR_BOM: int = 70
    # Colunas de auditoria/governança (metadados de controle do ETL, não
    # dado de negócio) ficam fora do cálculo de completude.
    AUDIT_COLUMNS: Annotated[tuple[str, ...], NoDecode] = (
        "NM_ORIGEM_GRAVACAO",
        "DT_GRAV_DADOS",
        "NM_ORIGEM_ALTERACAO",
        "DT_ATU_DADOS",
        "IN_ATIVO",
        "DS_HASH_LINHA",
    )
    # Dashboard — quantas tabelas são avaliadas ao mesmo tempo.
    HEALTH_CONCURRENCY: int = 10
    # Saúde do legado: schemas legados têm tabelas de milhões de linhas, então
    # avalia só uma amostra das MENORES tabelas (SYSCAT.TABLES.CARD) de cada
    # schema. LEGACY_CANDIDATE_POOL é quantas candidatas buscar para completar
    # LEGACY_SAMPLE_SIZE (algumas falham por permissão ou lentidão);
    # LEGACY_QUERY_TIMEOUT_SECONDS descarta a candidata imprevistamente lenta.
    LEGACY_HEALTH_CONCURRENCY: int = 8
    LEGACY_SAMPLE_SIZE: int = 5
    LEGACY_CANDIDATE_POOL: int = 20
    LEGACY_QUERY_TIMEOUT_SECONDS: float = 5.0

    # Cache em memória (por processo) das leituras do catálogo — metadados
    # (schemas, tabelas, colunas, busca) e medições que varrem dados
    # (completude/saúde). 0 desliga. Com o cache ligado, chamadas simultâneas
    # iguais compartilham uma única execução.
    CATALOG_CACHE_TTL_SECONDS: float = 300.0
    CATALOG_HEALTH_CACHE_TTL_SECONDS: float = 1800.0
    # Conexões do engine de leitura do catálogo (CATALOG_SOURCE=postgres);
    # deve acompanhar HEALTH_CONCURRENCY/LEGACY_HEALTH_CONCURRENCY.
    CATALOG_POOL_SIZE: int = 12

    # Pool do engine assíncrono (app/db/engine.py) — dimensionar conforme nº
    # de réplicas e limite de conexões do Postgres do ambiente.
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    # Logging estruturado (obslog) — stdout sempre ativo; sink em Postgres é
    # opt-in (LOG_DB_ENABLED). Grava em `cur_tin.log_exec_web` — schema/
    # tabela padronizados pela organização (default do próprio dh-helper-log
    # `LogConfig`, não configurado aqui de propósito, mesmo raciocínio do
    # rnc2/server) — compartilhada entre todos os apps Morlan, não uma
    # tabela deste app, e não criada pela migração deste template: espera-se
    # que já exista (infra compartilhada, mesmo raciocínio do Keycloak — ver
    # CLAUDE.md). Cada linha é gravada com APP_NAME na coluna de app,
    # identificando qual app escreveu aquele registro.
    LOG_LEVEL: str = "INFO"
    LOG_DB_ENABLED: bool = False
    LOG_DB_MIN_LEVEL: str = "WARNING"
    LOG_DB_BATCH_SIZE: int = 50
    LOG_DB_FLUSH_INTERVAL_SECONDS: float = 2.0
    # Identidade deste app, gravada em toda linha de log_event (coluna
    # cd_app) — é o que distingue as linhas deste app das de outros apps
    # Morlan na mesma tabela compartilhada. Sem default de propósito, mesmo
    # raciocínio do DATABASE_SCHEMA: cada clone deste template escolhe o
    # próprio nome, nunca reaproveita o de outro app.
    APP_NAME: str

    model_config = {"env_file": ".env", "extra": "ignore"}

    @field_validator(
        "KEYCLOAK_EXTRA_CLAIMS", "AUDIT_COLUMNS", "DEV_USER_ROLES", mode="before"
    )
    @classmethod
    def split_claims(cls, value: str) -> tuple[str, ...]:
        if isinstance(value, str):
            return tuple(s for s in map(str.strip, value.split(",")) if s)
        return value

    @model_validator(mode="after")
    def _montar_database_url(self) -> "Settings":
        if not self.DATABASE_URL and self.DATABASE_HOST:
            from urllib.parse import quote_plus

            user = quote_plus(self.DATABASE_USER)
            pwd = quote_plus(self.DATABASE_PASSWORD)
            self.DATABASE_URL = f"postgresql+asyncpg://{user}:{pwd}@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"

        return self

    @model_validator(mode="after")
    def _limitar_app_name_a_coluna_do_log(self) -> "Settings":
        # cur_tin.log_exec_web.cd_app é varchar(20): um APP_NAME maior faz o
        # Postgres recusar o lote inteiro de logs (e nada é gravado).
        if len(self.APP_NAME) > _MAX_APP_NAME_LENGTH:
            raise ValueError(
                f"APP_NAME ({self.APP_NAME!r}) tem {len(self.APP_NAME)} caracteres; "
                f"o máximo é {_MAX_APP_NAME_LENGTH} (coluna cd_app do log)."
            )
        return self

    @model_validator(mode="after")
    def _exigir_db2_quando_fonte_db2(self) -> "Settings":
        if self.CATALOG_SOURCE != "db2":
            return self
        faltando = [
            nome
            for nome in (
                "DB2_HOST",
                "DB2_PORT",
                "DB2_DATABASE",
                "DB2_USER",
                "DB2_PASSWORD",
            )
            if not getattr(self, nome)
        ]
        if faltando:
            raise ValueError(
                f"CATALOG_SOURCE=db2 exige {', '.join(faltando)} — preencha no "
                ".env ou use CATALOG_SOURCE=postgres."
            )
        return self

    @model_validator(mode="after")
    def _reject_auth_bypass_outside_debug(self) -> "Settings":
        if self.DEV_AUTH_BYPASS and not self.DEBUG:
            raise ValueError(
                "DEV_AUTH_BYPASS só pode ser ligado com DEBUG=True — ele elimina "
                "a autenticação e nunca deve existir em produção."
            )
        return self

    @model_validator(mode="after")
    def _reject_weak_session_secret_in_production(self) -> "Settings":
        # Mesmo raciocínio do rnc2/server: DEBUG=True (dev local) aceita
        # qualquer valor — só produção (DEBUG=False) exige um segredo de
        # verdade, já que é ele que assina a sessão BFF.
        if self.DEBUG:
            return self
        if len(self.SESSION_SECRET) < _MIN_SESSION_SECRET_LENGTH:
            raise ValueError(
                f"SESSION_SECRET precisa ter ao menos {_MIN_SESSION_SECRET_LENGTH} "
                "caracteres em produção (DEBUG=False)."
            )
        return self


# O pyright não sabe que pydantic-settings preenche os campos obrigatórios a
# partir de env vars/.env em tempo de execução, então ele enxerga uma chamada
# sem DATABASE_URL — um falso positivo conhecido para subclasses de
# BaseSettings.
settings = Settings()  # pyright: ignore[reportCallIssue]
