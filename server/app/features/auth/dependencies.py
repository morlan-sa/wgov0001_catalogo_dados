"""Dependência FastAPI de autenticação, compartilhada entre features.

Duas camadas empilhadas, mesma estrutura que `rnc2/server`'s
`app/features/auth/dependencies.py` usa (lá, com uma terceira por cima —
lookup na tabela local `usuario_rnc`, que este template não tem):

1. `_get_sso_user` — nível 1 (autenticação), resolve a sessão BFF pro
   `CurrentUser` (`codigo_usuario`, `nome`, `email`, `roles`, `groups`).
2. `get_current_user` — soma o gate de acesso ao app (nível 0,
   `access_gate.ensure_app_access` — ver esse módulo pro raciocínio
   completo) por cima: autenticado não basta, também precisa ter acesso
   concedido a ESTE app na Morlan Access.

Se este projeto crescer a ponto de precisar de uma tabela de usuários
própria (papéis/permissões internos, nível 3), o módulo do rnc2 é a
referência a seguir para empilhar mais um lookup por cima deste mesmo
dependency — não substituí-lo.

Não é uma feature com rotas próprias — `create_auth_router` (montado em
app/main.py) já cobre login/callback/me/logout; este módulo não tem
`controller.py`, então `discover_routers` (app/main.py) simplesmente o
ignora.
"""

from fastapi import Depends
from morlan_access import CurrentUser, make_get_current_user

from app.db.auth_engine import get_auth_db
from app.features.auth.access_gate import ensure_app_access

_get_sso_user = make_get_current_user(get_auth_db)


async def get_current_user(
    sso_user: CurrentUser = Depends(_get_sso_user),
) -> CurrentUser:
    await ensure_app_access(sso_user)
    return sso_user


__all__ = ["CurrentUser", "get_current_user"]
