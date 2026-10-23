# docs/old — o que saiu do projeto por não estar em uso

Tudo aqui foi **movido**, não apagado, depois de uma análise de uso (`knip` no `web/`,
`vulture` no `server/`, mais conferência manual). Nada daqui é importado, executado ou
publicado pelo app. Para restaurar, mova de volta para o caminho original (o mesmo caminho
relativo dentro desta pasta).

## Código do PoC (substituído)

| Pasta | O que era | Substituído por |
|---|---|---|
| `backend/` | API Node.js + Express (`ibm_db`) do PoC | `server/` (FastAPI) |
| `frontend/` | SPA React 18 + JavaScript + Tailwind/lucide do PoC | `web/` (React 19 + TypeScript + `@morlan/ui`) |

Foram movidos com `git mv`, então o histórico continua acessível (`git log --follow`).
O mapeamento tela a tela e rota a rota está em `CLAUDE.md` ("Catálogo (DB2, read-only)") e em
[`../001_documentacao_negocio.md`](../001_documentacao_negocio.md).

> `backend/node_modules` e `frontend/node_modules` (~210 MB, ignorados pelo git) vieram junto
> no movimento. Não são código: regeneram-se com `npm ci` a partir dos `package-lock.json`.
> Podem ser apagados com segurança se você não for rodar o PoC.

## Peças do template sem uso

Caminho original em `web/`:

| Arquivo | Por que saiu |
|---|---|
| `src/hooks/use-reset-on-open.ts` | nenhum componente o importa |
| `public/logo.png`, `public/logo.svg` | nenhum arquivo os referencia (o logo vem de `Logo`, em `@morlan/ui`) |
| `tsconfig.node.json` | `tsconfig.json` não o referencia; `tsc` e o `vite build` não o leem |
| `src/utils/format.unused.ts` | `formatDateTime`, `formatDate`, `capitalize`, `keysOf`, `identityOptions`, `displayCNPJ`, `displayCPF`, `formatDocument` — saíram de `src/utils/format.ts`, que ficou só com `getInitials` e `extractErrorMessage` |

## Dependências removidas de `web/package.json`

`@fontsource/ibm-plex-sans`, `clsx` e `tailwind-merge`. A fonte da interface vem de
`@fontsource-variable/ibm-plex-sans` (mantida); `clsx` e `tailwind-merge` são dependências do
próprio `@morlan/ui`, que as instala sozinho. Para voltar: `npm install <pacote>`.

## O que ficou de propósito, mesmo sem uso hoje

- `web/src/components/theme-toggler.tsx` — a norma de telas da Morlan exige o alternador de tema
  ao alcance do usuário. Ele precisa ser **ligado** ao layout, não guardado.
- `server/app/features/health/` — público de propósito (health check do load balancer).
- `docs/superpowers/` — desenho e planos do PoC (histórico de decisão).
