"""Gate de acesso ao app (nível 0) — server/app/features/auth/access_gate.py
e sua fiação em get_current_user (dependencies.py). Mesmo padrão de
rnc2/server's tests/test_access_gate.py, adaptado: aqui get_current_user
devolve o CurrentUser direto (sem lookup em tabela local — este template
não tem uma).
"""

from __future__ import annotations

from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException
from morlan_access import CurrentUser
from morlan_access.authz import ResolucaoAcesso

from app.features.auth import access_gate
from app.features.auth.access_gate import BASELINE_FUNCIONALIDADE, ensure_app_access
from app.features.auth.dependencies import get_current_user


def _sso_user(codigo: str = "u1") -> CurrentUser:
    return CurrentUser(
        codigo_usuario=codigo, nome="Teste", email="u1@test.com", roles=[]
    )


class TestEnsureAppAccess:
    async def test_permite_quando_funcionalidade_baseline_presente(self):
        with patch.object(
            access_gate._client,
            "resolve",
            Mock(
                return_value=ResolucaoAcesso(
                    usuario="u1",
                    sistema="template",
                    papel="usuario",
                    funcionalidades=[BASELINE_FUNCIONALIDADE],
                    bypass=False,
                )
            ),
        ):
            await ensure_app_access(_sso_user())  # não levanta

    async def test_nega_quando_funcionalidade_baseline_ausente(self):
        with patch.object(
            access_gate._client,
            "resolve",
            Mock(
                return_value=ResolucaoAcesso(
                    usuario="u1",
                    sistema="template",
                    papel="usuario",
                    funcionalidades=[],
                    bypass=False,
                )
            ),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await ensure_app_access(_sso_user())
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail["codigo"] == "SEM_ACESSO_APP"

    async def test_bypass_permite_mesmo_sem_a_funcionalidade_baseline(self):
        with patch.object(
            access_gate._client,
            "resolve",
            Mock(
                return_value=ResolucaoAcesso(
                    usuario="u1",
                    sistema="template",
                    papel="admin",
                    funcionalidades=[],
                    bypass=True,
                )
            ),
        ):
            await ensure_app_access(_sso_user())  # não levanta

    async def test_falha_da_access_api_nega_por_fail_safe(self):
        # ResolucaoAcesso.negada() é o que o AccessApiClient real devolve
        # internamente em qualquer falha de rede/HTTP — simulado aqui
        # devolvendo-a direto do resolve(), sem precisar derrubar conexão.
        with patch.object(
            access_gate._client,
            "resolve",
            Mock(return_value=ResolucaoAcesso.negada("u1", "template")),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await ensure_app_access(_sso_user())
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail["codigo"] == "SEM_ACESSO_APP"


class TestGetCurrentUserWiring:
    async def test_propaga_403_do_gate(self):
        negado = HTTPException(status_code=403, detail={"codigo": "SEM_ACESSO_APP"})
        with patch(
            "app.features.auth.dependencies.ensure_app_access",
            side_effect=negado,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(sso_user=_sso_user())
        assert exc_info.value.detail == {"codigo": "SEM_ACESSO_APP"}

    async def test_devolve_o_current_user_quando_gate_permite(self):
        sso_user = _sso_user("cod123")
        with patch(
            "app.features.auth.dependencies.ensure_app_access", return_value=None
        ):
            result = await get_current_user(sso_user=sso_user)
        assert result is sso_user


class TestGateDesabilitadoEmDev:
    async def test_pula_o_gate_com_debug_e_flag(self):
        resolve = Mock()
        with (
            patch.object(access_gate.settings, "DEBUG", True),
            patch.object(access_gate.settings, "ACCESS_GATE_DISABLED", True),
            patch.object(access_gate._client, "resolve", resolve),
        ):
            await ensure_app_access(_sso_user())
        resolve.assert_not_called()

    async def test_flag_e_ignorada_sem_debug(self):
        with (
            patch.object(access_gate.settings, "DEBUG", False),
            patch.object(access_gate.settings, "ACCESS_GATE_DISABLED", True),
            patch.object(
                access_gate._client,
                "resolve",
                Mock(
                    return_value=ResolucaoAcesso(
                        usuario="u1",
                        sistema="x",
                        papel=None,
                        funcionalidades=[],
                        bypass=False,
                    )
                ),
            ),
            pytest.raises(HTTPException) as exc,
        ):
            await ensure_app_access(_sso_user())
        assert exc.value.status_code == 403
