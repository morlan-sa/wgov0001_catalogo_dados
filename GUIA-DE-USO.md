# wgov0001_catalogo_dados — checklist do que falta fazer

> Este guia veio do template Morlan e agora é **independente**: `web/src/pages/home.tsx` foi
> substituída pelo Dashboard real, então os dois não são mais gêmeos. **Apague este arquivo**
> (e o link para ele em `README.md` e `CLAUDE.md`) quando todo o checklist abaixo estiver feito.

O projeto já foi renomeado (`wgov0001_catalogo_dados`, `APP_NAME`, `DATABASE_SCHEMA=cur_gov`,
sufixo do Alembic), a feature de exemplo foi removida e o espelho SQL do DBA foi regenerado.
Sobra o que é ato humano: Keycloak, segredos, credenciais do DB2, valores de infraestrutura em
`deploy/env.dev.json`, cadastro na esteira (`infraestrutura`) e no portal Morlan Access. As
seções de identidade abaixo descrevem o que **já foi feito** — leia-as só como referência.

> [!NOTE]
> **Não rode `rm -rf .git` neste repositório.** O trecho do template sobre isso valia só para
> o primeiro clone, que já aconteceu.

## Índice

- [Stack incluída](#stack-incluída)
- [Como rodar](#como-rodar)
- [Checklist: do template ao projeto real](#checklist-do-template-ao-projeto-real)
  - [Identidade do projeto](#identidade-do-projeto)
  - [Ambiente (.env)](#ambiente-env)
  - [Autenticação (Keycloak + produção)](#autenticação-keycloak-produção)
  - [Rotas e features](#rotas-e-features)
  - [Autorização (opcional)](#autorização-opcional)
  - [Deploy e infraestrutura](#deploy-e-infraestrutura)
- [Estrutura de pastas](#estrutura-de-pastas)

## Stack incluída

| Camada            | Tecnologia                                 |
| ----------------- | ------------------------------------------ |
| Frontend          | React 19 + TypeScript                      |
| Build             | Vite 8                                     |
| Roteamento        | React Router 7 (rotas em `App.tsx`)        |
| Dados assíncronos | TanStack Query (`src/lib/query-client.ts`) |
| HTTP              | axios (`src/lib/api.ts`)                   |
| Autenticação      | `@morlan/access-web` (SSO/Keycloak)        |
| UI                | `@morlan/ui` + Tailwind v4                 |
| Ícones            | Hugeicons                                  |
| Testes            | Vitest + Testing Library                   |

## Como rodar

```bash
# autenticado no CodeArtifact (ver "Deploy e infraestrutura" abaixo)
cd web && npm install && npm run dev
cd server && uv sync && npm run dev

# ou os dois de uma vez
docker compose up --build
```

## Checklist: do template ao projeto real

### Identidade do projeto

- [ ] **Nome e branding do frontend** — Ajuste `"name"` em `web/package.json` e o `<title>` em
      `web/index.html`. Não há favicon configurado ainda — adicione um `<link rel="icon">` em
      `index.html` se o projeto precisar de um.
- [ ] **Tela de login (`landing` em `App.tsx`)** — Renderizada pela própria `RequereAutenticacao`
      (`@morlan/access-web`) via seu `landing={{ nome, subtitulo, imagemFundoUrl }}` embutido
      quando não há sessão — este projeto não mantém mais uma página de login própria. Troque o
      nome do projeto `Template Web` e o texto de apresentação pelos valores reais direto nesse
      objeto.
- [ ] **Nome do backend** — `"name"`/`"version"` em `server/pyproject.toml` e o
      `FastAPI(title="Template API", ...)` em `server/app/main.py` são hardcoded, sem env var —
      edite direto no código.
- [ ] **Sufixo da tabela de controle do Alembic** — `VERSION_TABLE =
    "alembic_version_template"` em `server/app/db/alembic_version_table.py` — troque o sufixo
      `_template` pelo nome real deste projeto. Ambientes que já rodaram migrações sob o nome
      antigo se ajustam sozinhos na próxima `alembic upgrade head` (o `env.py` faz o
      `ALTER TABLE ... RENAME` sozinho); só o valor de `VERSION_TABLE` no código precisa ser
      trocado. Depois de trocar, regenere `server/alembic/dba_migrations/sql/`
      (`npm run dba:generate`) — o nome antigo fica hardcoded nesses arquivos também.
- [ ] **Nomes dos containers** — `container_name: template-server`/`template-web` em
      `compose.yml` — cosmético, mas evita colisão ao rodar vários clones deste template ao
      mesmo tempo.
- [ ] **Registrar o app no catálogo de CI/CD** — este repositório não tem `.github/workflows/`
      nem nenhuma config de esteira própria: todo pipeline (build, teste, deploy) é uma entrada
      Terraform no catálogo central de `infraestrutura` (`accounts/deployments/catalogo.tf`,
      `locals.apps`), feita por quem administra aquele repositório. Peça essa entrada com o nome
      real do projeto (`<projeto>-api`/`<projeto>-web`) antes do primeiro deploy — ver
      `deploy/README.md` para o formato exato da entrada.
- [ ] **Variáveis públicas do deploy (`deploy/env.dev.json`)** — a esteira central aplica este
      arquivo à task definition no deploy, quando a entrada do catálogo acima declarar
      `env_dir = "deploy"` — preencha todo placeholder `TODO-` (`APP_NAME`, `DATABASE_HOST`,
      `DATABASE_NAME`, `DATABASE_SCHEMA`, `FRONTEND_URL`, `KEYCLOAK_CLIENT_ID`,
      `MORLAN_ACCESS_SISTEMA`, `OIDC_REDIRECT_URI`) com os valores reais deste projeto/ambiente
      antes do primeiro deploy. Ver `deploy/README.md` para as regras (só valor público, arquivo
      substitui o conjunto inteiro).

### Ambiente (.env)

- [ ] **Identidade do app no Postgres compartilhado** — `APP_NAME` (`server/.env`) não tem valor
      padrão: escolha um nome próprio deste projeto, nunca reaproveite o de outro app Morlan.
      `DATABASE_SCHEMA` também não tem valor padrão, mas não é por-app — é o domínio de negócio a
      que as tabelas deste app pertencem; apps do mesmo domínio compartilham o mesmo schema,
      então confirme o domínio de negócio deste projeto antes de preencher, em vez de inventar um
      nome específico deste app.
- [ ] **API e proxy do frontend** — `VITE_API_URL` (`web/.env`) precisa continuar
      relativo/mesma origem — nunca uma URL absoluta cross-origin, senão o cookie de sessão
      para de ser enviado. `API_PROXY_TARGET` (sem prefixo `VITE_`, só lido pelo
      `vite.config.ts` em dev) aponta para onde o backend roda localmente.
- [ ] **Ajustes opcionais de cache** — `VITE_QUERY_RETRY` e `VITE_QUERY_STALE_TIME_MS`
      (`web/.env`) afinam o `QueryClient` padrão (`src/lib/query-client.ts`) — já têm fallback
      no código, só mexa se o projeto precisar de outro comportamento.

### Autenticação (Keycloak + produção)

- [ ] **Credenciais do realm** — `KEYCLOAK_ISSUER`/`CLIENT_ID`/`CLIENT_SECRET`,
      `OIDC_REDIRECT_URI` e (só se o hostname interno do Docker for diferente do público)
      `OIDC_INTERNAL_ISSUER` em `server/.env`, com os valores reais do realm cadastrado para
      este projeto.

> [!WARNING]
> **Segredos de verdade** — `SESSION_SECRET` vem com um valor de exemplo em
> `server/.env.example` — troque por um segredo real antes de produção. Isso já é validado:
> com `DEBUG=False`, `Settings` recusa iniciar se `SESSION_SECRET` ainda for o valor de exemplo
> ou tiver menos de 32 caracteres (`server/app/config.py`).

> [!WARNING]
> **Hardening de produção** — `DEBUG=False`, `COOKIE_SECURE=True` e `FRONTEND_URL` apontando
> para a origem real de produção — os padrões do `.env.example` são para desenvolvimento
> local.

- [ ] **Sessão em produção: considere Redis/ElastiCache** — Por padrão (`SESSION_STORE=rds`) a
      sessão de usuário vive na tabela `sessao`, em `IAM_SCHEMA` (`cur_iam`) — sem infra extra,
      mas sem fail-closed: Postgres fora do ar vira erro 500 na resolução de sessão, não 401.
      Para o caminho já usado em produção pelo `rnc2/server`, troque pra `SESSION_STORE=redis` e
      preencha `SESSION_REDIS_HOST`/`_PORT`/`_DB`/`_TLS`/`_AUTH` (Amazon ElastiCache) — reinstale
      o pacote `redis` primeiro (removido de `pyproject.toml` enquanto este projeto roda em
      `rds`). Só o modo `redis` é fail-closed: Redis fora do ar vira sessão não resolvida (401),
      nunca derruba a aplicação.

### Rotas e features

- [ ] **Adicione suas rotas** — Crie páginas em `src/pages` e registre-as em `App.tsx`. No
      backend, copie a forma de `app/features/health/` para novas features.

> [!CAUTION]
> **Rotas de negócio não são protegidas por padrão** — `app/features/health/` fica pública de
> propósito (health check do load balancer não manda cookie de sessão) — não copie essa
> ausência de auth para uma rota de verdade. `get_current_user` vive em
> `server/app/features/auth/dependencies.py` (não descartável); `server/app/features/example/`
> é uma feature genérica e descartável mostrando como usar `Depends(get_current_user)` numa
> rota de verdade — copie a forma dela e depois apague só essa pasta (junto com
> `web/src/pages/example.tsx` e `web/src/hooks/queries/example.ts`, o consumidor de ponta a
> ponta). Mais contexto em `CLAUDE.md` (seção "Auth architecture") e no teste
> `server/tests/test_example_feature.py`.
>
> Ver funcionando em [`/example`](/example) (com o app rodando).

### Autorização (opcional)

- [ ] **Papel macro (nível 2)** — `user.roles` (de `useSessao()`) e `hasRole()` já vêm de graça
      do Keycloak, sem código extra no backend. Autorização fina por funcionalidade (nível 3 —
      `AccessProvider`/`RequerFuncionalidade`/`GuardRota`) fica deliberadamente fora deste
      template; ver README de `@morlan/access-web` se o projeto precisar.

### Deploy e infraestrutura

- [ ] **Autentique no CodeArtifact antes de instalar dependências** — `uv sync` (`server/`) e
      `npm install` (`web/`) puxam `morlan-access-lib`/`@morlan/*` do CodeArtifact — exige AWS
      CLI já configurado (`aws configure`/SSO). Autentique antes de instalar (o token dura
      ~12h — repita o login quando expirar):

  ```bash
  # server/ — pip/python
  aws codeartifact login --tool pip --repository python --domain <domain> --domain-owner <account-id> --region us-east-1

  # web/ — npm
  aws codeartifact login --tool npm --repository npm --domain <domain> --domain-owner <account-id> --region us-east-1
  ```

> [!NOTE]
> **Docker aqui é só para dev/local** — `Dockerfile`/`nginx.conf` e o `compose.yml` deste repo
> sobem os apps localmente (`docker compose up --build`) — não é o que roda em produção. O
> build de `server`/`web` autentica no CodeArtifact à parte (`CODEARTIFACT_AUTH_TOKEN`), já que
> o container não enxerga o `aws codeartifact login` rodado no host — exporte um token fresco
> (`CODEARTIFACT_AUTH_TOKEN=$(aws codeartifact get-authorization-token --domain <domain>
> --domain-owner <account-id> --query authorizationToken --output text)`, dura ~12h) antes de
> `docker compose up --build`, ou os dois secrets (`codeartifact_token`/`npm_token`) ficam
> vazios e o build falha com um erro de secret ausente antes mesmo de tentar `uv sync`/`npm ci`.

> [!NOTE]
> **Produção é ECS Fargate, fora deste repo** — Infraestrutura como código (Terraform) e o
> catálogo central de esteiras de CI/CD (AWS CodePipeline/CodeBuild, disparado por
> CodeConnections no GitHub — não GitHub Actions) vivem no repo `infraestrutura`. Este
> repositório não contém config de esteira nenhuma: ver "Registrar o app no catálogo de CI/CD"
> acima e o checklist de onboarding no wiki golden path (ECR, ALB compartilhado, ECS, Keycloak,
> secrets, pipeline).
>
> - [`infraestrutura`](https://github.com/morlan-sa/infraestrutura)
> - [`wiki-goldenpath-docs`](https://github.com/morlan-sa/wiki-goldenpath-docs)

## Estrutura de pastas

`src/components`, `contexts`, `hooks`, `layouts`, `lib`, `pages`, `types`, `tests` —
preservada de `rnc2/web` para consistência entre projetos Morlan. Sessão/autenticação vive em
`src/contexts/sessao-provider.tsx`, sobre `@morlan/access-web` — não uma implementação própria.
