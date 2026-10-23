"""Teste do handler global (`app/main.py`'s `unhandled_exception_handler`) —
última linha de defesa para qualquer exceção não tratada. Reaproveita o
endpoint `health` só como veículo (via override de `get_db`) para forçar uma
exceção que `health/service.py` não trata (`SQLAlchemyError` é capturado lá;
qualquer outra não é), sem precisar de uma rota dedicada só para este teste.

Usa `starlette.testclient.TestClient` (síncrono), não o `httpx.AsyncClient`
usado no resto da suíte: `ServerErrorMiddleware` sempre re-levanta a exceção
original depois de chamar o handler instalado (de propósito — é assim que um
servidor real logaria o erro), então um `httpx.AsyncClient`/`ASGITransport`
puro nunca chega a devolver a `Response`, só propaga a exceção. `TestClient`
existe exatamente para esse caso: `raise_server_exceptions=False` inspeciona
a resposta 500 de verdade em vez da exceção.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

from starlette.testclient import TestClient

from app.db.engine import get_db
from app.main import app


class TestUnhandledExceptionHandler:
    def test_unhandled_exception_returns_sanitized_500(self):
        db = AsyncMock()
        db.execute.side_effect = RuntimeError(
            "boom - internal detail that must not leak"
        )
        app.dependency_overrides[get_db] = lambda: db
        try:
            client = TestClient(app, raise_server_exceptions=False)
            r = client.get("/api/health")
        finally:
            app.dependency_overrides.clear()
        assert r.status_code == 500
        assert r.json() == {"detail": "Erro interno do servidor"}
        assert "boom" not in r.text
        assert "RuntimeError" not in r.text
