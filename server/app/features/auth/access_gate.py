"""Gate de acesso ao app (nível 0) — distinto de qualquer RBAC que este
projeto venha a construir por cima (nível 3, dentro do app; ver o
comentário sobre `access_api_base_url`/`access_api_sistema` em app/main.py,
deliberadamente fora deste template).

Estar autenticado via SSO não basta: o usuário também precisa ter acesso
concedido a ESTE app especificamente no portal Morlan Access — senão, dá
pra contornar o launcher (que só mostra o app pra quem tem acesso)
navegando direto pela URL. Módulo portado de rnc2/server (mesmo nome,
mesmo raciocínio) — ver lá para o histórico completo do porquê.

A Access API não tem um sinal confiável de "sem acesso" no endpoint
service-to-service (`authz/resolve`, o que `AccessApiClient` chama):
`papel` cai pra "usuario" mesmo quando o usuário não tem nenhum Perfil no
sistema, então `papel`/`funcionalidades` vazio sozinho não distingue
"nunca provisionado" de "provisionado sem nenhuma funcionalidade extra".
Por isso o gate usa uma convenção: uma Funcionalidade baseline
(`ACESSO_APP`), concedida por padrão a todo Perfil real do sistema deste
projeto na Morlan Access — a ausência dela é o sinal real.

Pendente neste projeto (ato humano):
1. MORLAN_ACCESS_SISTEMA já está em `.env.example`/`deploy/env.dev.json` como
   WGOV0001-CATALOGO-DADOS — a aplicação precisa estar cadastrada com essa
   chave no catálogo da Morlan Access.
2. Pedir a quem administra a Morlan Access pra seedar a Funcionalidade
   `ACESSO_APP` sob esse sistema e concedê-la a todo Perfil real hoje
   cadastrado — sem isso, ESTE GATE NEGA TODO MUNDO (fail-safe = negar, de
   propósito — uma Access API fora do ar ou um sistema mal configurado não
   deve deixar todo mundo entrar por acidente).
"""

from fastapi import HTTPException, status
from morlan_access import CurrentUser
from morlan_access.authz import AccessApiClient
from starlette.concurrency import run_in_threadpool

from app.config import settings

BASELINE_FUNCIONALIDADE = "ACESSO_APP"

SEM_ACESSO_APP = {
    "codigo": "SEM_ACESSO_APP",
    "mensagem": (
        "Seu usuário está autenticado, mas não tem acesso liberado a este "
        "sistema. Solicite acesso pelo portal (morlan-access) ou contate o "
        "administrador."
    ),
}

# Singleton de módulo — uma instância por request desperdiçaria o cache em
# memória de 60s do AccessApiClient (chave (usuario, sistema)).
_client = AccessApiClient(base_url=settings.MORLAN_ACCESS_API_URL)


async def ensure_app_access(sso_user: CurrentUser) -> None:
    """Levanta 403 (corpo com codigo=SEM_ACESSO_APP) se o usuário autenticado
    não tiver a Funcionalidade baseline no sistema deste projeto. Fail-safe
    = negar: qualquer falha ao consultar a Access API já vira
    ResolucaoAcesso.negada() dentro do AccessApiClient, então uma Access API
    fora do ar bloqueia todo mundo em vez de deixar passar."""
    if settings.DEBUG and settings.ACCESS_GATE_DISABLED:
        return
    resolucao = await run_in_threadpool(
        _client.resolve, sso_user.codigo_usuario, settings.MORLAN_ACCESS_SISTEMA
    )
    if not resolucao.permite(BASELINE_FUNCIONALIDADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=SEM_ACESSO_APP
        )
