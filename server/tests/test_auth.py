"""Fiação do router de auth (morlan_access) — usa um engine sqlite
in-memory isolado via override de `get_auth_db` (não o Postgres real, nem
o Keycloak real: só o wiring `create_auth_router(get_auth_db)` em
app/main.py). Login/callback/logout completos já são cobertos pela suíte
da própria lib (morlan-access-api-lib/tests/) — não duplicados aqui.
"""

from __future__ import annotations

from httpx import ASGITransport, AsyncClient
from morlan_access.models import AuthBase
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
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def _get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    return _get_db


class TestAuth:
    async def test_me_without_session_returns_401(self):
        app.dependency_overrides[get_auth_db] = _sqlite_get_auth_db()
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                r = await client.get("/api/auth/me")
        finally:
            app.dependency_overrides.clear()
        assert r.status_code == 401
