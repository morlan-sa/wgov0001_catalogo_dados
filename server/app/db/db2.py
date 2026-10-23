"""Acesso SOMENTE LEITURA ao DB2 — fonte dos metadados do catálogo (SYSCAT.*).

Este não é o banco do app (esse é a Postgres compartilhada, em
`app/db/engine.py`): o catálogo só consulta o DB2, nunca grava nele. A
proteção é dupla — o usuário DB2 configurado não tem privilégio de escrita, e
`query()` recusa qualquer comando que não comece com SELECT/WITH antes mesmo
de abrir a conexão.

`ibm_db_dbi` é síncrono; cada consulta abre e fecha a própria conexão numa
thread (`asyncio.to_thread`) para não bloquear o event loop.
"""

import asyncio
import logging
import os
import time
from collections.abc import Sequence
from typing import Any

import ibm_db_dbi

from app.config import settings

logger = logging.getLogger(__name__)

# O driver CLI lê a codepage do ambiente do processo no momento da conexão —
# não há parâmetro de DSN equivalente. Só escreve (a leitura é de `settings`).
os.environ.setdefault("DB2CODEPAGE", settings.DB2_CODEPAGE)

_SQL5005C = "SQL5005C"
_READ_ONLY_PREFIXES = ("SELECT", "WITH")


class Db2ReadOnlyError(ValueError):
    """Comando que não é consulta (SELECT/WITH) — bloqueado sem abrir conexão."""


def _dsn() -> str:
    return (
        f"DATABASE={settings.DB2_DATABASE};"
        f"HOSTNAME={settings.DB2_HOST};"
        f"PORT={settings.DB2_PORT};"
        "PROTOCOL=TCPIP;"
        f"UID={settings.DB2_USER};"
        f"PWD={settings.DB2_PASSWORD};"
    )


def _connect() -> Any:
    try:
        return ibm_db_dbi.connect(_dsn(), "", "")
    except ibm_db_dbi.Error as exc:
        if _SQL5005C not in str(exc):
            raise
        logger.warning(
            "DB2 devolveu %s ao conectar; tentando novamente uma vez", _SQL5005C
        )
        time.sleep(settings.DB2_CONNECT_RETRY_DELAY_SECONDS)
        return ibm_db_dbi.connect(_dsn(), "", "")


def _run(sql: str, params: Sequence[Any]) -> list[dict[str, Any]]:
    conn = _connect()
    try:
        cursor = conn.cursor()
        try:
            cursor.execute(sql, tuple(params) if params else None)
            columns = [d[0] for d in cursor.description]
            return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]
        finally:
            cursor.close()
    finally:
        conn.close()


def _ensure_read_only(sql: str) -> None:
    trimmed = sql.strip()
    if not trimmed.upper().startswith(_READ_ONLY_PREFIXES):
        first_words = " ".join(trimmed.split()[:3])
        raise Db2ReadOnlyError(
            "Somente consultas SELECT são permitidas "
            f"(query bloqueada por segurança de leitura): {first_words}"
        )


async def query(sql: str, params: Sequence[Any] = ()) -> list[dict[str, Any]]:
    """Executa um SELECT/WITH e devolve as linhas como dicts, com as chaves
    no nome da coluna em maiúsculas (como o DB2 devolve). Parâmetros
    posicionais (`?`)."""
    _ensure_read_only(sql)
    return await asyncio.to_thread(_run, sql, params)
