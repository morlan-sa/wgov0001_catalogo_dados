"""Ponto único de leitura da fonte do catálogo: DB2 ou Postgres, conforme
`Settings.CATALOG_SOURCE`. Só leitura, nos dois casos.

Os serviços do catálogo chamam `query()` sem saber qual banco há por trás; o
SQL de cada banco vem de `app/features/catalog/dialect.py`. Com `postgres` a
leitura usa o engine assíncrono do app (`DATABASE_*`) — o mesmo Postgres, mas
só consultas ao `pg_catalog` e às tabelas descritas por ele.
"""

import logging
from collections.abc import Sequence
from typing import Any

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config import settings

logger = logging.getLogger(__name__)

_READ_ONLY_PREFIXES = ("SELECT", "WITH")


class CatalogReadOnlyError(ValueError):
    """Comando que não é consulta (SELECT/WITH) — bloqueado sem abrir conexão."""


class CatalogPermissionError(Exception):
    """O usuário do banco não tem privilégio de leitura no objeto consultado
    (Postgres 42501 / DB2 SQL0551N). É esperado — nem toda tabela do catálogo
    é legível — e não deve virar erro 500."""


_SQLSTATE_SEM_PRIVILEGIO = "42501"
_DB2_SEM_PRIVILEGIO = "SQL0551N"


def _sem_privilegio(exc: Exception) -> bool:
    orig = getattr(exc, "orig", exc)
    if getattr(orig, "sqlstate", None) == _SQLSTATE_SEM_PRIVILEGIO:
        return True
    texto = str(exc)
    return (
        _DB2_SEM_PRIVILEGIO in texto or f"SQLSTATE={_SQLSTATE_SEM_PRIVILEGIO}" in texto
    )


def _ensure_read_only(sql: str) -> None:
    trimmed = sql.strip()
    if not trimmed.upper().startswith(_READ_ONLY_PREFIXES):
        first_words = " ".join(trimmed.split()[:3])
        raise CatalogReadOnlyError(
            "Somente consultas SELECT são permitidas "
            f"(query bloqueada por segurança de leitura): {first_words}"
        )


def _to_named_params(sql: str, params: Sequence[Any]) -> tuple[str, dict[str, Any]]:
    """`?` posicionais (estilo DB2) → `:p0, :p1…` do SQLAlchemy `text()`."""
    parts = sql.split("?")
    if len(parts) - 1 != len(params):
        raise ValueError("Quantidade de parâmetros diferente da de '?' no SQL")
    named = parts[0] + "".join(f":p{i}{part}" for i, part in enumerate(parts[1:]))
    return named, {f"p{i}": value for i, value in enumerate(params)}


_pg_engine: AsyncEngine | None = None


def _get_pg_engine() -> AsyncEngine:
    """Engine próprio do catálogo (lazy), separado do `engine` de negócio.

    O catálogo só lê e cada consulta é independente, então a conexão é
    otimizada para latência: AUTOCOMMIT (sem BEGIN/COMMIT/ROLLBACK por
    consulta), sem `pre_ping` nem reset ao devolver ao pool — com o RDS a
    ~130 ms de distância, cada ida e volta evitada pesa. Cada conexão nova
    nasce em modo SOMENTE LEITURA no próprio Postgres, rede de segurança
    além do `_ensure_read_only`."""
    global _pg_engine
    if _pg_engine is None:
        _pg_engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            isolation_level="AUTOCOMMIT",
            pool_size=settings.CATALOG_POOL_SIZE,
            max_overflow=0,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            pool_recycle=settings.DB_POOL_RECYCLE,
            pool_pre_ping=False,
            pool_reset_on_return=None,
        )

        @event.listens_for(_pg_engine.sync_engine, "connect")
        def _somente_leitura(dbapi_conn, _record) -> None:
            cursor = dbapi_conn.cursor()
            try:
                cursor.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
            finally:
                cursor.close()

    return _pg_engine


async def _query_postgres(sql: str, params: Sequence[Any]) -> list[dict[str, Any]]:
    named, bind = _to_named_params(sql, params)
    async with _get_pg_engine().connect() as conn:
        result = await conn.execute(text(named), bind)
        return [dict(row) for row in result.mappings()]


async def warm_up() -> None:
    """Abre a primeira conexão (TLS + login levam ~3 s) antes do primeiro
    usuário. Nunca levanta: se o banco estiver fora, o erro aparece na
    primeira consulta de verdade."""
    if settings.CATALOG_SOURCE != "postgres":
        return
    try:
        await _query_postgres("SELECT 1", [])
    except Exception:
        logger.warning(
            "Não foi possível esquentar a conexão do catálogo", exc_info=True
        )


async def query(sql: str, params: Sequence[Any] = ()) -> list[dict[str, Any]]:
    """Executa um SELECT/WITH na fonte do catálogo e devolve as linhas como
    dicts, com as chaves exatamente como o SQL as nomeia (os SQLs do catálogo
    nomeiam as colunas fixas em maiúsculas nos dois bancos). Parâmetros
    posicionais (`?`)."""
    _ensure_read_only(sql)
    try:
        if settings.CATALOG_SOURCE == "postgres":
            return await _query_postgres(sql, params)

        from app.db import db2

        return await db2.query(sql, params)
    except Exception as exc:
        if _sem_privilegio(exc):
            raise CatalogPermissionError(
                "Sem permissão de leitura nesta tabela para o usuário do banco"
            ) from exc
        raise
