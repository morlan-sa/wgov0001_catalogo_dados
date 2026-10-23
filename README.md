# wgov0001_catalogo_dados — Catálogo de Dados

Portal de **governança e catálogo de dados** da Morlan: navega os metadados do **DB2**
(schemas → tabelas → colunas) com camada (STG/CUR/RPT/legado), domínio de negócio e
classificação da informação inferidos dos nomes e comentários, e calcula a **saúde dos dados**
(completude real de preenchimento) por tabela e por schema. É somente leitura: não grava nada
no DB2 nem em tabela própria.

Monorepo no padrão BFF da Morlan — frontend Vite/React (`web/`) e backend FastAPI (`server/`),
autenticação SSO real via Keycloak, deploy no golden path da plataforma (ECS Fargate via
`infraestrutura`). Convertido do PoC `WGOV0001` (Node/Express + React 18) para este padrão.

> Falta o que é ato humano (Keycloak, segredos, credenciais do DB2, cadastro na esteira e no
> portal Morlan Access): [`GUIA-DE-USO.md`](GUIA-DE-USO.md) tem o checklist — apague-o quando
> estiver tudo feito. A arquitetura para quem mexe no código está em [`CLAUDE.md`](CLAUDE.md).

| Pasta                | O que é      | Stack                                                          |
| -------------------- | ------------ | -------------------------------------------------------------- |
| [`web/`](web/)       | Frontend SPA | React 19 + TypeScript + Vite + `@morlan/ui` + TanStack Query   |
| [`server/`](server/) | Backend BFF  | FastAPI + SQLAlchemy 2.0 (async) + Alembic + `ibm_db` + `uv`   |
| [`deploy/`](deploy/) | Config       | variáveis públicas por ambiente (`env.<ambiente>.json`)        |
| [`docs/`](docs/)     | Documentação | negócio, técnica, diagramas de sequência e DER                 |

## Telas

| Rota                         | Tela                                                                       |
| ---------------------------- | -------------------------------------------------------------------------- |
| `/`                          | Dashboard — contadores, tabelas por camada e saúde por schema (governados e legado) |
| `/catalogo`                  | Schemas, com busca de schema e busca de coluna em todas as tabelas         |
| `/catalogo/:schema`          | Tabelas e views do schema, com classificação e saúde                       |
| `/catalogo/:schema/:table`   | Colunas, tipos, domínio, chave primária e completude por coluna            |
| `/scanner`                   | Assistente em 2 passos para escolher quais schemas explorar                |
| `/dominios`, `/dominios/:code` | Domínios de negócio e os schemas do DB2 que usam cada um                 |

## API (`/api`, toda autenticada, exceto `health`)

| Rota                                              | O que devolve                                  |
| ------------------------------------------------- | ---------------------------------------------- |
| `GET /api/schemas`                                | schemas com contagem de tabelas/views, camada e domínio |
| `GET /api/catalog/schemas?filter=A,B`             | idem, restrito à seleção                       |
| `GET /api/catalog/schemas/{schema}/tables`        | tabelas/views com descrição e classificação    |
| `GET /api/catalog/schemas/{schema}/tables/{table}`| detalhe com colunas e completude               |
| `GET /api/catalog/schemas/{schema}/tables/{table}/saude` | saúde resumida da tabela                |
| `GET /api/catalog/columns/search?q=&filter=`      | colunas cujo nome contém o termo               |
| `GET /api/dashboard/summary`                      | contadores agregados                           |
| `GET /api/dashboard/saude`, `/saude-legado`       | saúde dos schemas governados / amostra do legado |
| `GET /api/domains`                                | os 24 domínios com uso real                    |
| `GET /api/health`                                 | público — health check do load balancer        |

## Autenticação

BFF/OIDC, sem tokens no browser — nem `web/` nem `server/` implementam login próprio, isso é
do Keycloak. O backend (`morlan-access-lib`) conduz OIDC login/callback/sessão/logout; o
frontend (`@morlan/access-web`) só redireciona, lê `/me` e chama `logout()`. Toda rota de
negócio exige `Depends(get_current_user)`, que também aplica o gate de acesso ao app
(funcionalidade `ACESSO_APP` na Morlan Access). Detalhe em "Auth architecture" de
[`CLAUDE.md`](CLAUDE.md).

## Antes de instalar dependências

`morlan-access-lib`/`@morlan/*`/`dh-helper-*` resolvem do AWS CodeArtifact — sem isso, nem
`uv sync` nem `npm install` completam. Com AWS CLI já configurado (`aws configure`/SSO):

```bash
aws codeartifact login --tool pip --repository python --domain morlan --domain-owner 537528034206 --region us-east-1
aws codeartifact login --tool npm --repository npm --domain morlan --domain-owner 432837989720 --region us-east-1
```

O token dura ~12h — repita o login quando expirar. (O `uv` não lê a configuração do `pip`:
exporte `UV_INDEX_CODEARTIFACT_USERNAME=aws` e `UV_INDEX_CODEARTIFACT_PASSWORD` com o token de
`aws codeartifact get-authorization-token`.)

## Desenvolvimento

Pré-requisitos: Node 22+, Python 3.12+ com [uv](https://docs.astral.sh/uv/), AWS CLI, uma
Postgres acessível (compartilhada entre apps Morlan — isolamento por schema; aqui `cur_gov`),
um Redis ou Postgres para a sessão (ver `SESSION_STORE` em `server/.env.example`), acesso de
leitura ao **DB2** de desenvolvimento e o driver CLI do DB2 (`ibm_db` o instala sozinho; em
máquina com `clidriver` já instalado, aponte `IBM_DB_HOME`).

```bash
# server/ (localhost:8000)
cd server
uv sync
cp .env.example .env   # preencha Postgres, Keycloak, SESSION_SECRET e DB2_USER/DB2_PASSWORD
npm run dev             # wrapper de `uv run uvicorn app.main:app --reload`

# web/ (localhost:5173), em outro terminal
cd web
npm install
cp .env.example .env
npm run dev
```

Ou os dois via Docker (exige `CODEARTIFACT_AUTH_TOKEN` exportado antes do build):

```bash
docker compose up --build
```

## Testes

```bash
cd web && npm run lint && npm run typecheck && npm run test && npm run build
cd server && uv run ruff check . && uv run pyright . && uv run pytest -q
```

Os testes do servidor são offline (DB2, Postgres e Keycloak nunca são contatados); o
`tests/conftest.py` define valores fictícios para as variáveis obrigatórias.

## Deploy

Produção é ECS Fargate via `infraestrutura` (Terraform + AWS CodePipeline/CodeBuild) — **não**
`docker compose`, que existe só para dev local. Este repositório **não contém nenhuma
configuração de esteira**: o pipeline (build, teste, deploy, migração, aprovação) é declarado
no catálogo Terraform de `infraestrutura`, disparado por push em `develop`/`release`/`main`.
Aqui ficam, por componente, o `Makefile` com alvo `test`, o `Dockerfile` e
[`deploy/env.dev.json`](deploy/env.dev.json) (ver [`deploy/README.md`](deploy/README.md)).
**Ninguém dispara deploy a partir daqui** — quem desenvolve não publica.

## Pendências conhecidas

- **Login e acesso:** o gate de acesso ao app nega todos até a `ACESSO_APP` ser semeada e
  concedida aos perfis reais na Morlan Access.
- **Imagem do servidor:** o PyPI tem wheel `ibm_db` `manylinux_2_34` para Python 3.12 (compatível
  com a base `bookworm` do `Dockerfile`), mas o `docker build` e a conexão ao DB2 de dentro do
  container **não foram executados** — as bibliotecas de sistema que o driver exige em runtime
  não estão confirmadas.
- **Debug/log:** a exportação de log para arquivo e o liga/desliga de debug por aplicação ainda
  dependem de decisão da plataforma (R1–R4).
- **Padrões de tela:** rodapé institucional, diálogo "Sobre" com a versão e o destaque da letra
  do mnemônico `Alt`+letra ainda não existem na `@morlan/ui` — demandas a abrir na biblioteca.
