"""Apoio dos testes de rota: cliente HTTP contra o app real (`app.main.app`),
com e sem sessão, sem Postgres, Keycloak, Redis ou DB2 reais.

Mesmo padrão de `tests/test_auth.py`: sqlite in-memory isolado via override de
`get_auth_db`; `obter_sessao` e o gate de acesso (nível 0) são mocados para a
rota resolver (ou não) o `CurrentUser` sem infra de verdade.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient
from morlan_access.models import AuthBase
from morlan_access.session_store import SessaoView
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.auth_engine import get_auth_db
from app.main import app


def _sqlite_get_auth_db():
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    AuthBase.metadata.create_all(engine)
    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def _get_db():
        db = session_local()
        try:
            yield db
        finally:
            db.close()

    return _get_db


@asynccontextmanager
async def anonymous_client() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_auth_db] = _sqlite_get_auth_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


@asynccontextmanager
async def authenticated_client() -> AsyncIterator[AsyncClient]:
    from morlan_access.config import get_config

    sessao = SessaoView(
        codigo_usuario="jdoe",
        nome="Jane Doe",
        email="jane@example.com",
        roles="admin",
        groups="",
    )
    cookie_name = get_config().session_cookie
    app.dependency_overrides[get_auth_db] = _sqlite_get_auth_db()
    try:
        with (
            patch(
                "app.features.auth.dependencies.ensure_app_access",
                AsyncMock(return_value=None),
            ),
            patch("morlan_access.session_store.obter_sessao", return_value=sessao),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
                cookies={cookie_name: "sid-valida"},
            ) as client:
                yield client
    finally:
        app.dependency_overrides.clear()
