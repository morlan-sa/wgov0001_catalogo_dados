# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`wgov0001_catalogo_dados` is Morlan's **Catálogo de Dados** (portal de governança): a web app
that lets people browse the metadata of the corporate **DB2** — schemas → tables → columns —
with business domain, layer (STG/CUR/RPT/LEGADO) and information classification inferred from
the names/comments, plus a "saúde dos dados" (real completeness) score per table and per
schema. It is a monorepo with a Vite/React frontend (`web/`) and a FastAPI backend (`server/`),
plus a root `compose.yml`, built on the Morlan BFF template (`morlan-sa/web-template`) — same
shape as the sibling project `rnc2`. There is no npm/uv workspace tooling tying the two
together; each app is fully self-contained with its own `package.json`/`pyproject.toml`/
`Dockerfile`/`.env.example` (rnc2 doesn't use workspace tooling either — deliberate).

It was converted from a Node/Express + React 18 (JavaScript) proof of concept (`WGOV0001`) to
the Morlan standard. The domain lives in four vertical slices under `server/app/features/`
(`schemas`, `catalog`, `dashboard`, `domains`) — see "Catálogo (DB2, read-only)" below — and
the screens are `web/src/pages/{dashboard,catalogo,catalogo-schema,catalogo-tabela,scanner,
dominios,dominio}.tsx`.

**Authentication is real SSO via Keycloak**, not a stub — both apps consume Morlan's internal
auth libraries in the BFF pattern: the backend (`morlan-access-lib`, import `morlan_access`)
owns the OIDC login/callback/session/logout routes and the session cookie; the frontend
(`@morlan/access-web`) only redirects to Keycloak, reads `/me`, and calls `logout()`. Neither
app renders its own login/registration/password UI — that's Keycloak's job. See "Auth
architecture" below before touching either side of this. Every business route requires
`Depends(get_current_user)`; `app/features/health/` is the only public one, on purpose.

## Project state after bootstrapping

The template's bootstrapping (rename, example-feature removal, DBA SQL mirror regeneration) is
**done**; its step-by-step instructions were removed from here on purpose — they start with
`rm -rf .git`, which must never be run in this repository. What is left is human work, listed
in [`GUIA-DE-USO.md`](GUIA-DE-USO.md) (delete that file once the whole list is done):

- Keycloak realm/client for this app (`KEYCLOAK_*`, redirect URIs), `SESSION_SECRET`, DB2
  credentials (`DB2_USER`/`DB2_PASSWORD`) — typed by a person, never committed.
- Fill the remaining `TODO-` placeholders in `deploy/env.dev.json` (RDS host, `FRONTEND_URL`,
  `KEYCLOAK_CLIENT_ID`, `OIDC_REDIRECT_URI`, DB2 host/port) and add the DB2 credentials to
  Secrets Manager (via `infraestrutura`'s Terraform `secrets` block).
- Register this app in `infraestrutura`'s catalog (`wgov0001_catalogo_dados-api` / `-web`) —
  never an edit in this repo — and register it in the Morlan Access portal as
  `WGOV0001-CATALOGO-DADOS` (also the value of `MORLAN_ACCESS_SISTEMA`), seeding the
  `ACESSO_APP` funcionalidade for the real profiles (the level-0 gate denies everyone without it).
- `uv run alembic upgrade head` against a real dev Postgres, once `.env` is filled.

Identity: project `wgov0001_catalogo_dados`; `APP_NAME=wgov0001` (≤ 20 chars — `cur_tin.log_exec_web.cd_app` is `varchar(20)`; a longer value makes Postgres reject whole log batches);
`DATABASE_SCHEMA=cur_gov` (business domain GOV — shared with sibling apps of that domain);
Alembic version table `alembic_version_wgov0001_catalogo_dados`.

## Commands

### `web/` (Vite + React)

`@morlan/access-web`/`@morlan/ui` resolve from AWS CodeArtifact (see
"Both `morlan-access-lib` and `@morlan/access-web`..." below) — before the
first `npm install`/`npm ci`, run `aws codeartifact login --tool npm
--repository npm --domain <domain> --domain-owner <account-id> --region
us-east-1` (needs AWS CLI credentials already configured — `aws configure`
or SSO login; the token this writes to `~/.npmrc` lasts ~12h).

```bash
cd web
npm install             # install deps — CodeArtifact login above must run first
npm run dev            # Dev server (Vite) — proxies /api to API_PROXY_TARGET, see below
npm run build           # tsc -b && vite build
npm run test            # vitest run
npm run typecheck       # tsc --noEmit
npm run lint            # ESLint
```

Run a single test file: `npx vitest run src/tests/use-sessao.test.tsx`.

### `server/` (FastAPI)

Same CodeArtifact requirement as `web/` above, but the `pip`/`python` tool
and repository: `aws codeartifact login --tool pip --repository python
--domain <domain> --domain-owner <account-id> --region us-east-1` before
`uv sync` (also ~12h-lived; re-run when it expires).

```bash
cd server
uv sync                 # install deps — CodeArtifact login above must run first
npm run dev              # uv run uvicorn app.main:app --reload
npm run test             # uv run pytest
npm run lint             # uv run ruff check .
npm run check-types      # uv run pyright .
npm run upgrade          # uv run alembic upgrade head — creates the shared Postgres schema
npm run migrate -- "add x"   # uv run alembic revision --autogenerate -m "add x"
```

`server/package.json` is just an `npm run <name>`-shaped wrapper over `uv`
commands (no JS dependencies) — same shape as `rnc2/server`'s, purely so
both apps in this monorepo share one command vocabulary. Run the `uv run
...` commands directly if you'd rather skip the wrapper.

### Whole stack

```bash
docker compose up --build   # server + web, from the repo root — no postgres service, see "Deployment" below
```

## Auth architecture (read this before changing anything auth-related)

**BFF/OIDC, cookie-based, no tokens in the browser.** `server/` calls
`morlan_access.configure(BffAuthConfig(...))` (from `app/config.py` settings)
and mounts `create_auth_router(get_auth_db)` in `app/main.py`, which
registers (prefix hardcoded by the lib, not configurable):

```
GET  /api/auth/login      -> 302 to Keycloak
GET  /api/auth/callback   -> exchanges code for tokens, creates a session, sets a cookie
GET  /api/auth/me         -> current user from the session cookie, or 401
POST /api/auth/logout     -> clears the session, may return a Keycloak logout_url
```

`web/` never talks to Keycloak directly: `src/contexts/sessao-provider.tsx` calls
`@morlan/access-web`'s `fetchMe()` once per page load and shares the result via
context (`useSessao()`, in `src/hooks/use-sessao.ts`); `src/App.tsx` wraps
the whole route tree in `RequereAutenticacao` (`@morlan/access-web/react`),
using its built-in `landing` object prop (`{ nome, subtitulo, imagemFundoUrl }`,
rendered internally by the lib's own `TelaLoginApp`) to show a split-screen
"Entrar" screen when there's no session (fed by `useSessao()`) — this
project has no landing page of its own, just the identity strings passed to
`landing={{...}}`; clicking "Entrar" calls `login()` — a real
`window.location` redirect to `/api/auth/login`, never an in-app form.
`fetchMe()` **throws** on anything other than a clean 401 (backend down,
misconfigured proxy, etc.) — `SessaoProvider` catches that and fails closed
(treats it as unauthenticated) rather than hanging on a loading spinner
forever; don't remove that `.catch()`.

**Everything under `/api/*` must be same-origin with the frontend** — the
session cookie is `SameSite=Lax`, which is not sent on a genuine
cross-origin `fetch`/XHR (only on top-level navigations). That's why:

- `web/vite.config.ts` proxies `/api` to `API_PROXY_TARGET` (default
  `http://localhost:8000`) in dev — same-origin from the browser's point of
  view. In production, `web/nginx.conf` does **not** proxy `/api/` at all
  (see "Deployment" below for why) — the shared ALB routes `/api/*` straight
  to the API's own ECS service before nginx ever sees the request, which is
  still same-origin from the browser's perspective since the routing
  happens entirely behind the single public hostname. `morlan_access`'s
  auth router hardcodes its own prefix as `/api/auth` either way.
- `src/lib/api.ts`'s axios instance defaults its `baseURL` to `/api`
  (relative) for the same reason — the app's own business routes should
  live under `/api/*` too (see `server/app/main.py`'s
  `app.include_router(router, prefix="/api")` — applied once, centrally,
  to every discovered feature router; each feature's own `APIRouter` only
  declares its sub-prefix, e.g. `app/features/health/controller.py`'s
  `prefix="/health"`) so they ride the same proxy and keep getting the
  session cookie.

**Sync vs. async DB engines — this is the one non-obvious piece.**
`morlan_access.create_auth_router`/`make_get_current_user` require a
**sync** SQLAlchemy `Session` generator (`Callable[[], Iterator[Session]]`),
but this app's own data access is fully **async** (`AsyncSession`/`asyncpg`,
`app/db/engine.py`). `app/db/auth_engine.py` is a second, sync engine
(`psycopg2`, not `asyncpg`) that exists to satisfy this contract —
`get_auth_db()` from that file is what gets passed into
`create_auth_router`/`make_get_current_user`, never `get_db()`. Business
features keep using the async engine as normal. It also doubles up as the
log sink's engine (see `dh_helper.obslog` below). With `SESSION_STORE=rds`
(default — see "Session storage" below), the lib writes user sessions
through this same engine into the `sessao` table, in `Settings.IAM_SCHEMA`
(`cur_iam`, the Morlan Access/IAM schema — not this app's own
`DATABASE_SCHEMA`) — created by the `0001_create_sessao` migration.

**Protecting a business route.** Nothing does this automatically —
`app/features/health/controller.py`'s route is deliberately public (load
balancer health checks don't send a session cookie), so don't copy its
lack of auth by default. `app/features/auth/dependencies.py` exports
`get_current_user = make_get_current_user(get_auth_db)` (from
`morlan_access`, same sync engine as above) — same call `rnc2/server`
makes internally in its own `app/features/auth/dependencies.py`, just not
wrapped in a local-DB user lookup, since this template has no local user
table (see that module's docstring). Wire it into any route that needs a
session:

```python
from fastapi import Depends
from app.features.auth.dependencies import CurrentUser, get_current_user

@router.get("/whatever")
async def whatever(current_user: CurrentUser = Depends(get_current_user)):
    ...
```

Copy the shape of any feature controller (e.g. `app/features/schemas/controller.py`), not
`health/`'s, when a new route needs auth. `tests/test_routes_auth.py` proves every business
route 401s without a session and answers 200 with one (helpers in `tests/helpers.py`).
`get_current_user` resolves the session cookie to a `CurrentUser`
(`codigo_usuario`, `nome`, `email`, `roles`,
`groups`) or raises 401 itself. This is nível 1
(authentication) only — nível 2 (macro role) is just checking
`current_user.roles`/`hasRole()`, no extra backend wiring needed;
nível 3 (fine-grained permissions) is the deliberately-unwired
`AccessApiClient` path below.

**Session storage: `"rds"` by default, `"redis"` for production
ElastiCache.** `Settings.SESSION_STORE` defaults to `"rds"` — the lib
writes sessions to the `sessao` table in `Settings.IAM_SCHEMA` (`cur_iam`),
via the sync engine in `app/db/auth_engine.py` (see "Sync vs. async DB
engines" above) — no extra infra needed for local dev. The lib also
supports `"redis"` (`SESSION_REDIS_HOST`/`_PORT`/`_DB`/`_TLS`/`_AUTH`, wired
into `BffAuthConfig` in `app/main.py`, fail-closed if Redis is unreachable —
see `morlan_access.session_store.obter_sessao`), the mode `rnc2/server`
runs against Amazon ElastiCache in production — but this template doesn't
use it today: the `redis` package isn't even installed (removed from
`pyproject.toml`). Switching to `"redis"` means reinstalling that
dependency and filling in `SESSION_REDIS_HOST` first.

**Both `morlan-access-lib` and `@morlan/access-web` are installed from AWS
CodeArtifact** — no git dependency, no SSH, on either side.
`server/pyproject.toml` pins `morlan-access-lib` to an explicit
`[[tool.uv.index]]` entry (`name = "codeartifact"`, `explicit = true`) via
`[tool.uv.sources]`; `web/package.json` just has a normal
`"@morlan/access-web": "^0.11.0"` range, resolved through whatever registry
`.npmrc`/the user-level npm config points `@morlan:*` at.

**CodeArtifact auth is token-based and short-lived (~12h), not a
long-lived credential you commit anywhere.** Neither Dockerfile fetches a
token itself — both expect it handed in at build time:

- `server/Dockerfile`'s `uv sync` needs `UV_INDEX_CODEARTIFACT_USERNAME`/
  `UV_INDEX_CODEARTIFACT_PASSWORD` (`aws` / a freshly fetched
  `aws codeartifact get-authorization-token` value). The username is a
  fixed `ENV` in the Dockerfile; the token is read via
  `--mount=type=secret,id=codeartifact_token` (RAM-only, never written to
  an image layer) — `compose.yml`'s `secrets.codeartifact_token` sources
  it from the `CODEARTIFACT_AUTH_TOKEN` env var at build time. Building a
  single image directly needs `docker build --secret
id=codeartifact_token,env=CODEARTIFACT_AUTH_TOKEN ./server` instead,
  since there's no `compose.yml` to source the secret from.
- `web/Dockerfile`'s `npm ci` gets registry auth the same way
  `infraestrutura`'s centralized pipeline (`app-build-image.yml` buildspec)
  actually builds the image: an `ARG NPM_REGISTRY_URL` (just the
  registry endpoint, no credential in it — safe as a build-arg) plus
  `--mount=type=secret,id=npm_token` carrying only the raw token (RAM-only,
  never written to an image layer), composed into a throwaway `.npmrc`
  inside the `RUN` step. `compose.yml`'s `secrets.npm_token` sources it
  from the same `CODEARTIFACT_AUTH_TOKEN` env var as `server`'s
  `codeartifact_token`. Building a single image directly needs
  `docker build --build-arg
NPM_REGISTRY_URL=https://morlan-432837989720.d.codeartifact.us-east-1.amazonaws.com/npm/npm/
--secret id=npm_token,env=CODEARTIFACT_AUTH_TOKEN ./web` instead.

**Deliberately not wired**, same reasoning as the (now-superseded)
frontend-only stub had for RBAC:

- Nível 3 (fine-grained "funcionalidades" via the separate Morlan Access
  API — `AccessApiClient`/`requer_funcionalidade`/`create_funcionalidades_router`
  server-side, `AccessProvider`/`RequerFuncionalidade`/`GuardRota`
  client-side). `MORLAN_ACCESS_API_URL`/`MORLAN_ACCESS_SISTEMA` are blank by
  default — see each lib's README to enable it.
- Nível 2 (macro role) needs zero extra backend code: `roles` is already on
  `/api/auth/me`'s response and on `useSessao().user.roles`; `hasRole()` is
  available from `@morlan/access-web` whenever a project needs it.
- No local Keycloak in `compose.yml` — it's external infrastructure this
  template points at via `KEYCLOAK_*` env vars, not something it stands up.

## `web/` architecture (everything else, i.e. not auth)

Vite + React 19 + TypeScript SPA, no SSR. Path alias `@/*` → `./web/src/*`
(kept in sync between `tsconfig.json` and `vite.config.ts`/`vitest.config.ts`).

- `src/App.tsx` — single `createBrowserRouter` call, `RouteErrorBoundary` as
  the root `errorElement`, `RequereAutenticacao` wrapping everything (see
  above). `src/layouts/app-layout.tsx` renders `Navbar` + a title bar from
  `handle: { title }` via `useMatches()`.
- `src/lib/query-client.ts` — one shared TanStack Query `QueryClient`;
  `retry`/`staleTime` overridable via `VITE_QUERY_RETRY`/`VITE_QUERY_STALE_TIME_MS`.
- `src/components/route-error-boundary.tsx` — treats `AxiosError` 404s or
  `NotFoundError` (`src/utils/errors.ts`) as a 404, rendering `NotFound`.
  Throw `NotFoundError` for client-side "this ID isn't valid" cases.
- Styling: Tailwind v4 (CSS-first, no config file) layered under
  `@morlan/ui`'s stylesheet. `--font-sans` expects "IBM Plex Sans Variable"
  to be loaded by the consumer — `main.tsx` imports
  `@fontsource-variable/ibm-plex-sans`.
- **`@morlan/ui` components take priority over writing your own.** Before
  building any UI element (button, input, dialog, table, badge, skeleton,
  etc.), check whether `@morlan/ui` already has it —
  `web/node_modules/@morlan/ui/dist/index.d.ts` lists every exported
  component/hook in one file (`export { X, type XProps } from
'./components/x'`), so grepping it is faster than guessing from memory
  whether something exists. Only write a one-off component when
  `@morlan/ui` genuinely has no equivalent.
- Testing: default Vitest environment is `node`; DOM tests opt in with
  `// @vitest-environment jsdom`. `src/tests/test-utils.tsx` has a
  `renderWithProviders` helper for tests that don't need auth context.

## `server/` architecture (everything else)

FastAPI + SQLAlchemy 2.0 (async) + Alembic + `uv`, mirroring `rnc2/server`'s
conventions minus its domain features.

- `app/main.py` — logging setup runs first, before anything else that might
  log during its own setup: `configure_logging(LogConfig(...))`
  (`dh_helper.obslog`, from the `dh-helper-log` dependency); then
  `configure_auth()` + `create_auth_router` + CORS + the catch-all exception
  handler, then `discover_routers` (from the `dh-helper-fastapi` dependency,
  not a local file) auto-mounts every
  `app/features/<name>/controller.py`'s `router`, all under a single
  `prefix="/api"` applied at the `include_router` call site — feature
  routers themselves only declare their own sub-prefix (see "Auth
  architecture" above for why `/api` matters). `lifespan()` calls
  `shutdown_logging()` after `yield` so the batched DB writer thread
  flushes and stops cleanly.
- `dh_helper.obslog` (from `dh-helper-log`) — standalone structured logging
  (JSON to stdout, optional batched sink to Postgres). Its DB sink just
  needs a plain `sqlalchemy.Engine`, handed to it via `LogConfig(engine=...)`
  — `app/main.py` reuses `app/db/auth_engine.py`'s `auth_engine` for this
  rather than keeping a second connection pool to the same Postgres around
  for no reason. `create_engine()` is lazy (never connects at import time),
  and `configure_logging()`/`DbBatchHandler` never raise and don't touch the
  DB until their own background thread's first flush — so a bad connection
  here only ever surfaces as a stderr warning, never a startup crash.
- `app/features/<name>/{controller,schemas,models}.py` — vertical-slice
  layout, one folder per feature: `health/` (public), `schemas/`, `catalog/`,
  `dashboard/`, `domains/` (all authenticated) and `auth/` (the reusable
  `get_current_user`, no routes).
- `app/config.py` — `pydantic-settings` `Settings`, `.env`-backed.
- Alembic migrations live in `alembic/versions/`; `alembic/env.py` targets
  `Base.metadata` only (business data — this template ships zero domain
  models today). `0001_create_sessao.py` is a hand-written migration, not
  autogenerated from `Base.metadata` — `morlan_access.models.Sessao` lives
  on its own `AuthBase`/`DeclarativeBase`, outside `Base` entirely, and in a
  different schema (`IAM_SCHEMA`) besides — see "Sync vs. async DB engines"
  above. `cur_tin.log_exec_web` has no ORM model and no migration of its own
  in this template at all — see below, it's shared infra this app just
  points at, not a table this template creates.

**The Postgres is shared across every Morlan app — there's no dedicated
instance per project.** Isolation is by schema, not by database (same
reasoning as `cur_qua` in rnc2/server, just with a configurable name
instead of a hardcoded one): `Settings.DATABASE_SCHEMA` (`.env`, no
default) qualifies every table this app owns — but the name isn't per-app,
it's the **business domain** the tables belong to; other apps whose tables
belong to the same domain share this same schema name rather than each
getting their own.

- **Always configure the split `DATABASE_HOST`/`DATABASE_PORT`/`DATABASE_NAME`/
  `DATABASE_USER`/`DATABASE_PASSWORD` fields, in every environment — local dev
  included.** `DATABASE_URL` exists purely as a fallback (a `model_validator`
  in `app/config.py` assembles it from the split fields when it's left blank)
  and matches the contract `infraestrutura`'s ECS deploy pipeline already
  uses, injecting the RDS secret as separate fields rather than a single
  connection string — using the split fields everywhere keeps local `.env`
  and every deployed environment consistent instead of local dev being the
  odd one out. Only set `DATABASE_URL` directly for a one-off connection
  string that doesn't fit that shape (e.g. a non-RDS local Postgres with
  unusual auth).
- **`DATABASE_NAME` is fixed per environment, not per project** — every
  Morlan app on the shared Postgres instance (see below) uses the same
  database name for a given environment: `mtrd1` for development, `mtrh1`
  for homologation, `mtrp1` for production. Never invent a different
  `DATABASE_NAME`; `DATABASE_SCHEMA` is the one setting that varies here,
  and it varies by business domain, not by project (see above).
- `app/db/engine.py`'s `Base` uses a schema-qualified `MetaData`, so
  ordinary business-feature ORM code never has to think about it. That
  `MetaData` also sets a `naming_convention` (ported from `rnc2/server`) so
  every future autogenerated table names its own primary/foreign keys and
  indexes explicitly (`pk_<table>`, `fk_<table>_<column>`,
  `ix_<column_label>`) instead of relying on Postgres's implicit defaults —
  unique constraints have no such entry and are named by hand instead,
  `uq_<table_or_domain>_<column(s)>` (see the comment in `engine.py` for why).
- `app/db/auth_engine.py` sets `options=-c search_path=<schema>` on its
  connection — but note it's `Settings.IAM_SCHEMA`, not `DATABASE_SCHEMA`:
  with `SESSION_STORE=rds` (default), the lib's unqualified `sessao` queries
  need to land in `cur_iam` (Morlan Access/IAM's own schema), not this
  app's. See "Session storage" below.
- **A future reference/lookup table that isn't exclusive to this app's own
  domain** (shared with sibling apps in the same business domain, or
  genuinely cross-domain) should **not** inherit `Base`'s default
  schema-qualified `MetaData` — declare its own `schema=` explicitly
  (`__table_args__ = {"schema": "..."}` on the model) instead of relying on
  `app/db/engine.py`'s app-wide default, the same way `cur_tin.log_exec_web`
  below is already an exception to `DATABASE_SCHEMA` rather than the rule.
  There's no concrete example of this in the template today (it ships with
  zero domain models) — this is guidance for whenever the first shared
  reference table shows up, not something to scaffold now.
- `dh_helper.obslog`'s writer (fed the same `auth_engine` above) has no
  search_path/schema concept of its own — a non-issue, since it already
  builds `schema.table` itself from `LogConfig`'s `db_schema`/`db_table`
  before ever touching the connection. Unlike every other table in this
  app, that log table is deliberately **not** under `DATABASE_SCHEMA` —
  it's shared across every Morlan app (one physical table, not one per
  app). `app/main.py` doesn't pass `db_schema`/`db_table` to `LogConfig`
  at all — `dh-helper-log`'s own defaults (`cur_tin`/`log_exec_web`, the
  org-standardized schema/table for web execution logs) already point at
  the right place, so there's nothing for this template to override.
  Pre-existing shared infra this template just points at, same reasoning
  as Keycloak (see "Auth architecture" above): no migration here creates
  it or its schema. Every row is stamped with `Settings.APP_NAME` (own
  value per app, same shape as `DATABASE_SCHEMA`) in the `cd_app` column
  via `LogConfig(app_name=...)` — configured once here, not passed per
  `logger.<method>()` call — so rows from different apps sharing the
  table stay distinguishable.
- `alembic/env.py`'s `include_name`/`include_schemas`/`version_table_schema`
  restrict autogenerate reflection and the `alembic_version` bookkeeping
  table to just our own schema. **This isn't optional polish** — without
  it, `alembic revision --autogenerate` reflects the _entire_ shared
  database (every other app's schema too) and, diffed against only our
  metadata, would propose dropping tables that belong to other apps.
- `0000_create_schema.py` is the baseline migration that creates the
  schema itself (`CREATE SCHEMA IF NOT EXISTS`) — every later migration
  depends on it existing first, mirroring rnc2/server's own
  `0000_baseline_cur_qua.py`.
- Testing: `tests/conftest.py` sets `DATABASE_URL`/`DATABASE_SCHEMA` env vars
  before any `app.*` import (`Settings()` instantiates at module load).
  `tests/test_auth.py` overrides `get_auth_db` with a sqlite in-memory
  engine to test the `/api/auth/me` 401-without-session path — full
  login→callback→session flows are covered by `morlan-access-lib`'s own
  test suite, not duplicated here.

## Catálogo (DB2 ou Postgres, read-only)

The catalog reads whichever database `Settings.CATALOG_SOURCE` (`.env`) points at — `db2`
(default, the corporate DB2 via `SYSCAT.*`) or `postgres` (the Postgres in `DATABASE_*`, via
`pg_catalog`). Every screen is a live, read-only view of that source's metadata, nothing is
stored by the app (the Postgres schema `cur_gov` has no business tables today; Alembic only
creates the schema). The slices never know which one is behind them:

- `app/db/catalog_db.py` — `query()` dispatches by `CATALOG_SOURCE` (DB2 → `app/db/db2.py`,
  Postgres → the app's async engine inside a `SET TRANSACTION READ ONLY`), refusing anything
  but `SELECT`/`WITH` first. `DB2_*` are only required when `CATALOG_SOURCE=db2`.
- `app/features/catalog/dialect.py` — the per-source SQL (schemas/tables/columns/PK/search/
  smallest-table candidates), all returning the same uppercase-keyed row shape
  (`TABSCHEMA`, `TABNAME`, `TYPE` T/V, `REMARKS`, `COLNAME`…), plus `normalize`: DB2
  identifiers are uppercased by the API, Postgres ones are kept as typed (lowercase there).
  Inferences in `inference.py` are case-insensitive. Postgres lists only schemas that have
  tables/views; `cur_*` schemas are CUR, anything else (`public`, `dba`…) is inferred LEGADO.
- Tests fake `query`; the Postgres dialect is exercised via `patch.object(settings,
  "CATALOG_SOURCE", "postgres")` (`tests/test_catalog_source.py`). `tests/conftest.py` pins
  `CATALOG_SOURCE=db2` so a developer's `.env` choice doesn't change the suite.

- **Performance** — the dominant cost is network latency to the RDS (~130 ms per round
  trip), not SQL. `catalog_db` therefore uses its *own* Postgres engine (`AUTOCOMMIT`, no
  `pre_ping`, no reset-on-return, each connection born `READ ONLY` via a `connect` event):
  ~0.14 s per query vs ~0.95 s through the app's business engine (which paid pre_ping + `SET`
  + `BEGIN` + `ROLLBACK` per query). On top, `app/features/catalog/cache.py` is a TTL cache
  with in-flight dedupe (`CATALOG_CACHE_TTL_SECONDS` for metadata, `_HEALTH_` for the
  data-scanning completude/saúde; 0 disables — `conftest.py` sets 0), each caller gets a deep
  copy, failures are never cached. `lifespan()` warms the connection and `list_schemas`. Tables
  that fail in `get_saude_governanca` (e.g. no SELECT privilege) are skipped, not fatal.
  Measured against `mtrd1`: saúde da governança 38 s → ~7 s cold, legado 17 s → ~3 s, repeats ~0.

- **No SELECT on a table is expected, not a 500**: `catalog_db.query` turns Postgres `42501` /
  DB2 `SQL0551N` into `CatalogPermissionError`; `main.py` maps it to 403, `get_table_detail`
  still returns the structure with `leitura_negada=true` (`total_registros`/`saude` null — the
  page says the health couldn't be computed), and the dashboards skip such tables.

The rest of this section was written for the DB2 source; the same rules apply to both.

- `app/db/db2.py` — the only DB2 access (used when `CATALOG_SOURCE=db2`). `query()` runs a `SELECT`/`WITH` through
  `ibm_db_dbi` in a worker thread (`asyncio.to_thread`, one connection per call) and refuses
  anything else *before* opening a connection (`Db2ReadOnlyError`). One retry on `SQL5005C`
  (transient CLI-driver error under connection churn). `DB2CODEPAGE=1208` is set from
  `Settings.DB2_CODEPAGE` — without it accents in `REMARKS` come back as U+FFFD. It is a
  *third* data path next to the async (`get_db`) and sync (`get_auth_db`) Postgres engines —
  never pass it to the auth lib.
- Slices: `schemas/` (`GET /api/schemas`), `catalog/` (`/api/catalog/schemas[?filter=A,B]`,
  `.../{schema}/tables`, `.../tables/{table}`, `.../tables/{table}/saude`,
  `/columns/search?q=&filter=`), `dashboard/` (`/summary`, `/saude`, `/saude-legado`),
  `domains/` (`GET /api/domains`). `catalog/inference.py` + `reference.py` hold the pure
  inferences (camada by `STG_/CUR_/RPT_` prefix else `LEGADO`; domain by schema suffix against
  the 24 corporate domains; classification by regex on table `REMARKS`; column domain by prefix).
- **Saúde dos dados** = real completeness (`COUNT(col)` / `COUNT(*)`, text columns via
  `NULLIF(TRIM(col), '')`) averaged over business columns; audit columns
  (`Settings.AUDIT_COLUMNS`) are excluded. Thresholds: `COMPLETUDE_LIMIAR_EXCELENTE`/`_BOM`.
  Governed schemas are measured in full; `LEGADO` schemas by a sample of their smallest tables
  (`SYSCAT.TABLES.CARD`, `LEGACY_*` settings) because a single legacy table can have millions
  of rows. `schemas_sem_acesso` reports legacy schemas the DB2 user cannot read.
- Percentages round half up (`inference.round_half_up`, like JS `Math.round`) — Python's
  `round()` rounds half to even.
- JSON is snake_case (`schema_name`, `table_count`, …); `web/src/hooks/queries/*.ts` map it to
  camelCase. Errors are `{"detail": ...}` (404 unknown table, 400 invalid identifier).
- Dynamic identifiers (`"SCHEMA"."TABLE"` in the completeness query) are validated against
  `^[A-Za-z0-9_]+$` before being interpolated; values always go through `?` parameters.
- Tests are offline: `query` is faked, no DB2 is ever contacted.

## Deployment

**This repo owns no CI/CD pipeline config at all — by design.** Every
Morlan app's pipeline (build, test, deploy, migrate, rollback, prod
approval) is declared centrally in the `morlan-sa/infraestrutura` repo
(`accounts/deployments/catalogo.tf`, a Terraform-managed AWS CodePipeline +
CodeBuild setup — not GitHub Actions), triggered by a GitHub CodeConnections
webhook on push to `develop`/`release`/`main` (→ dev/homolog/prod). This
template used to ship its own `.github/workflows/deploy-api.yml`/
`deploy-web.yml`, calling reusable workflows in the old `plataforma-infra`
repo — both were deleted once CI/CD moved to this centralized, AWS-native
model; don't recreate them.

What this repo (and any real project cloned from it) *is* responsible for
providing, per component (`server/`, `web/`):

- **A `Makefile` with a `test` target** (`server/Makefile`, `web/Makefile`).
  The pipeline's test stage literally greps the component's `Makefile` for
  a `test:` rule and runs `make test` before building the image and on
  every pull request — no `Makefile`, no tests run (silent warning, not a
  failure). Mirrors `rnc2/server/Makefile`/`rnc2/web/Makefile` exactly: `uv
  sync --frozen && uv run ruff check . && uv run pytest -q` for `server/`,
  `npm ci --no-audit --no-fund && npm run lint && npm run test && npm run
  build` for `web/`.
- **A `Dockerfile`** — unchanged, still builds a standalone image (non-root
  user in both `server/` and `web/`). `nginx.conf`'s `add_header` block
  (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP —
  same set as `rnc2/web`'s `nginx.conf.template`) is real response headers
  in production, not a dev-only nicety; no HSTS there on purpose, since
  this container never terminates TLS itself (the shared ALB does).
- **`deploy/env.<ambiente>.json`**, optionally — see below.

Onboarding a real project means a PR to `infraestrutura`'s catalog (new
entries like `<project>-api`/`<project>-web`, declaring repo, build
context, trigger paths, `env_dir`, runtime) — never an edit in this repo.
That's `infraestrutura`'s own maintainers' job, not something to automate
from here.

**`web/nginx.conf` has no `/api/` proxy, on purpose.** In production, the
shared ALB routes `/api/*` straight to the API's own ECS service — a
path-based rule ahead of the web service's host-only catch-all (same
pattern as `rnc2`'s `apps.tf`) — so nginx never needs to reach `server` at
all. A hardcoded `proxy_pass` to a `server` hostname here would only ever
resolve inside local `docker compose` (that hostname doesn't exist
anywhere else) — that exact mistake silently rolled back every `rnc2`
production deploy behind the ECS deployment circuit breaker for months
before anyone noticed. One consequence: `docker compose up --build`'s
*built* web image has no working `/api/*` locally either (no compose-local
equivalent of the ALB) — for local iteration that needs both frontend and
backend, use `npm run dev` (Vite's own proxy, see "Auth architecture"
above), not the built compose image.

**`deploy/env.<ambiente>.json` holds the public (non-secret) env vars the
real ECS deploy injects.** If the component's `infraestrutura` catalog
entry sets an `env_dir` (this template's own entry would point it at
`deploy`, matching `rnc2-api`'s), the pipeline's deploy stage replaces the
whole container env with that commit's `deploy/env.<ambiente>.json` when it
deploys — resolved by the ambiente the pipeline is already running for, not
read from this repo. This file, not Terraform, is where a new env var
goes — see `deploy/README.md` for the full rules (the file replaces the
whole set on every deploy, and it's public values only; secrets stay in
Secrets Manager via Terraform's `secrets` block).
