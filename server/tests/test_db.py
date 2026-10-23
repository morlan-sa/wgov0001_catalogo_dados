"""Testes de `get_db`/`get_auth_db` — os dois generators de dependência de
sessão que `app/db/engine.py`/`app/db/auth_engine.py` expõem. Construir uma
`AsyncSession`/`Session` via `sessionmaker` não abre conexão nenhuma até a
primeira query real ser executada (SQLAlchemy é lazy nesse ponto), então
estes testes não precisam de um Postgres de verdade — só verificam que o
generator entrega o tipo certo e que o `finally: db.close()` de fato roda ao
ser exaurido.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.db.auth_engine import get_auth_db
from app.db.engine import get_db


class TestGetDb:
    async def test_yields_an_async_session_and_closes_it(self):
        with patch.object(AsyncSession, "close", new_callable=AsyncMock) as close:
            gen = get_db()
            session = await anext(gen)
            assert isinstance(session, AsyncSession)
            close.assert_not_called()
            with pytest.raises(StopAsyncIteration):
                await anext(gen)
            close.assert_awaited_once()


class TestGetAuthDb:
    def test_yields_a_sync_session_and_closes_it(self):
        with patch.object(Session, "close") as close:
            gen = get_auth_db()
            session = next(gen)
            assert isinstance(session, Session)
            close.assert_not_called()
            with pytest.raises(StopIteration):
                next(gen)
            close.assert_called_once()
