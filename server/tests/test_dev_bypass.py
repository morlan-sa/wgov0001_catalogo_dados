"""Usuário simulado de desenvolvimento (`DEV_AUTH_BYPASS`): nunca pode existir
fora do DEBUG, vem desligado, e quando ligado cobre `get_current_user` e o
`/api/auth/me` que o front consulta."""

from __future__ import annotations

import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.config import Settings
from app.features.auth.dependencies import CurrentUser, get_current_user
from app.features.auth.dev_bypass import dev_user, install_dev_bypass
from tests.helpers import anonymous_client


class TestSettings:
    def test_recusa_bypass_sem_debug(self):
        with pytest.raises(ValidationError, match="DEV_AUTH_BYPASS só pode ser ligado"):
            Settings(DEV_AUTH_BYPASS=True, DEBUG=False)  # pyright: ignore[reportCallIssue]

    def test_aceita_bypass_com_debug(self):
        s = Settings(DEV_AUTH_BYPASS=True, DEBUG=True)  # pyright: ignore[reportCallIssue]
        assert s.DEV_AUTH_BYPASS is True

    def test_vem_desligado_por_padrao(self):
        assert Settings().DEV_AUTH_BYPASS is False  # pyright: ignore[reportCallIssue]

    def test_papeis_aceitam_lista_separada_por_virgula(self):
        s = Settings(DEV_USER_ROLES="admin, dev")  # pyright: ignore[reportCallIssue]
        assert s.DEV_USER_ROLES == ("admin", "dev")


def _app_com_bypass() -> FastAPI:
    app = FastAPI()
    install_dev_bypass(app)

    @app.get("/api/protegida")
    async def protegida(user: CurrentUser = Depends(get_current_user)):
        return {"usuario": user.codigo_usuario, "roles": user.roles}

    return app


class TestComBypassLigado:
    async def test_rota_protegida_passa_sem_sessao(self):
        async with AsyncClient(
            transport=ASGITransport(app=_app_com_bypass()), base_url="http://test"
        ) as client:
            r = await client.get("/api/protegida")
        assert r.status_code == 200
        assert r.json()["usuario"] == dev_user().codigo_usuario

    async def test_me_devolve_o_usuario_simulado_no_formato_da_lib(self):
        async with AsyncClient(
            transport=ASGITransport(app=_app_com_bypass()), base_url="http://test"
        ) as client:
            r = await client.get("/api/auth/me")
        body = r.json()
        assert r.status_code == 200
        assert set(body) >= {"usuario", "nome", "email", "roles", "groups", "claims"}
        assert body["provider"] == "dev-bypass"


class TestAppRealContinuaProtegido:
    async def test_sem_o_bypass_a_rota_de_negocio_continua_401(self):
        # `app.main.app` é importado nos testes com DEV_AUTH_BYPASS desligado.
        async with anonymous_client() as client:
            r = await client.get("/api/schemas")
        assert r.status_code == 401
