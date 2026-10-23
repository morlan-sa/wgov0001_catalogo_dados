"""Testes do endpoint `health` — sem autenticação; 200 quando o banco
responde, 503 quando não.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

from httpx import ASGITransport, AsyncClient
from sqlalchemy.exc import OperationalError

from app.db.engine import get_db
from app.main import app


class TestHealth:
    async def test_health_returns_ok_when_db_reachable(self):
        app.dependency_overrides[get_db] = lambda: AsyncMock()
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                r = await client.get("/api/health")
        finally:
            app.dependency_overrides.clear()
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    async def test_health_returns_503_when_db_unreachable(self):
        db = AsyncMock()
        db.execute.side_effect = OperationalError("SELECT 1", {}, Exception("nope"))
        app.dependency_overrides[get_db] = lambda: db
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                r = await client.get("/api/health")
        finally:
            app.dependency_overrides.clear()
        assert r.status_code == 503

    async def test_health_does_not_require_authentication(self):
        """Nenhum header de autorização é enviado; a rota não depende de
        get_current_user, então não deve retornar 401/403."""
        app.dependency_overrides[get_db] = lambda: AsyncMock()
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                r = await client.get("/api/health")
        finally:
            app.dependency_overrides.clear()
        assert r.status_code not in (401, 403)
