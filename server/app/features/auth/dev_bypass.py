"""Usuário simulado para desenvolvimento local, sem Keycloak.

Ligado só por `Settings.DEV_AUTH_BYPASS`, que exige `DEBUG=True` (o `Settings`
recusa subir de outra forma). Faz duas coisas:

1. substitui `get_current_user` — e com ele o gate de acesso (nível 0) — por um
   `CurrentUser` fixo (`DEV_USER_*`), então toda rota de negócio passa;
2. registra `GET /api/auth/me` ANTES do router da `morlan_access` (a primeira
   rota que casa vence), devolvendo o mesmo JSON que a lib devolveria. É isso
   que faz o `@morlan/access-web` do front tratar o usuário como autenticado e
   nunca redirecionar ao Keycloak.

Não é uma tela de login (a norma não permite): não há usuário/senha, só uma
sessão simulada. `logout` continua sendo o da lib e não derruba o bypass — o
próximo `/me` volta a devolver o usuário simulado.

Este módulo não tem `controller.py`, então `discover_routers` o ignora.
"""

import logging

from fastapi import FastAPI
from morlan_access import CurrentUser

from app.config import settings
from app.features.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)


def dev_user() -> CurrentUser:
    return CurrentUser(
        codigo_usuario=settings.DEV_USER_CODIGO,
        nome=settings.DEV_USER_NOME,
        email=settings.DEV_USER_EMAIL,
        roles=list(settings.DEV_USER_ROLES),
        groups=[],
    )


def install_dev_bypass(app: FastAPI) -> None:
    logger.warning(
        "DEV_AUTH_BYPASS ligado: autenticação SIMULADA como %r — "
        "somente desenvolvimento local, nunca em produção.",
        settings.DEV_USER_CODIGO,
    )
    app.dependency_overrides[get_current_user] = dev_user

    @app.get("/api/auth/me", tags=["auth"])
    async def me_simulado():
        user = dev_user()
        return {
            "usuario": user.codigo_usuario,
            "nome": user.nome,
            "email": user.email,
            "roles": user.roles,
            "groups": user.groups,
            "claims": user.claims,
            "provider": "dev-bypass",
        }
