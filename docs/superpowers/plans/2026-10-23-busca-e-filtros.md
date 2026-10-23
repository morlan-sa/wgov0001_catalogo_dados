# Busca global, filtros e similaridade (fase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar, na home do catálogo, uma busca global de tabelas e colunas com ranking por semelhança, filtros facetados (camada, domínio, classificação, conformidade, só com descrição) e o atalho Ctrl+K.

**Architecture:** Um índice em memória de todo o catálogo (tabelas + colunas, com conformidade já calculada), montado com duas consultas e guardado no `ttl_cache`, alimenta um módulo puro de semelhança e um serviço de busca. `GET /api/catalog/search` devolve resultados paginados e contagens por faceta. O front ganha a aba "Buscar" no `/catalogo`, com o estado dos filtros na URL.

**Tech Stack:** FastAPI + pydantic + pytest (`server/`), React 19 + TanStack Query + `@morlan/ui` + Vitest (`web/`).

**Spec:** `docs/superpowers/specs/2026-10-23-portal-consulta-nomenclatura-design.md` (seções 3.3 e 6.5–6.7). Plano anterior (fases 1 e 2, já na `develop`): `docs/superpowers/plans/2026-10-23-nomenclatura-e-conformidade.md`. Fica para o plano da fase 4: API de reuso da skill (`/api/catalog/reuso*`), rótulo "forte" usado para recomendar, autenticação por token; fase 5 (auditoria, favoritos, exportações).

## Global Constraints

- Servidor em `server/` com `uv run`; testes com `DEV_AUTH_BYPASS=false uv run pytest -q` (o `.env` local liga o bypass e derruba 2 testes que não têm relação com este trabalho). Front em `web/` com `npx vitest run <arquivo>`, `npm run lint`, `npm run test`, `npm run build`. Não rodar `npm install`.
- JSON em `snake_case`; o front converte nos hooks de `web/src/hooks/queries/` (tipo "raw" + mapper exportado e testado).
- Testes offline (`query` simulado); funcionam para `CATALOG_SOURCE=db2` e `postgres`, com as linhas no mesmo formato de chaves maiúsculas dos dialetos existentes.
- Somente leitura: nada é gravado em banco; toda rota nova usa `Depends(get_current_user)` e entra em `ROTAS` de `server/tests/test_routes_auth.py`.
- Parâmetros em `app/config.py`, nunca no código. Novos: `CATALOG_INDEX_TTL_SECONDS: float = 900.0`, `CATALOG_INDEX_MAX_COLUMNS: int = 2_000_000`, `SIMILARIDADE_LIMIAR_FORTE: float = 0.85`, `SIMILARIDADE_LIMIAR_MEDIO: float = 0.60`, `CONFORMIDADE_FAIXA_ALTA: int = 90`, `CONFORMIDADE_FAIXA_MEDIA: int = 60`, `CATALOG_SEARCH_PAGE_SIZE_MAX: int = 100`. `tests/conftest.py` passa a fixar `CATALOG_INDEX_TTL_SECONDS=0` como já faz com os outros TTLs.
- Conformidade, colunas de auditoria e schemas LEGADO seguem as regras do plano anterior (conforme 1 / aviso `CONFORMIDADE_PESO_AVISO` / fora 0; LEGADO "não aplicável"). A regra vive em **um** lugar depois da Task 3.
- Texto da interface em português com acentuação; componentes do `@morlan/ui` antes de criar os próprios (o pacote **não** tem `Dialog` nem `Command`: use `Sheet`).
- Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Sem termo e sem filtro → lista ordenada por schema/tabela, paginada, sem erro. Termo só de pontuação ou de palavras vazias ("de", "do") → tratado como sem termo. (Task 4, 5)
- Filtro com valor desconhecido (`camada=XYZ`) → zero resultados, nunca 4xx/5xx; filtro multivalorado (`camada=CUR,STG`) soma os valores. (Task 5)
- Página além da última → lista vazia com `total` correto; `por_pagina` acima do máximo é limitado, não rejeitado. (Task 5)
- Faixa de conformidade nunca inclui tabela LEGADO, salvo o valor `na`. (Task 5)
- Contagem de cada faceta ignora o filtro dessa própria faceta (senão as outras opções somem). (Task 5)
- Primeira busca a frio demora (monta o índice): o front mostra carregando, não "nenhum resultado". Falha ao montar o índice → 503 com mensagem legível, não 500 cru. (Task 3, 7)
- Termo com acento, maiúsculas, `cód.`, `cod` ou pequeno erro de digitação acha a coluna certa. (Task 4)

## File Structure

- `server/app/features/catalog/conformidade.py` — regra única "avaliar colunas de negócio → `Resumo`" (Task 3).
- `server/app/features/catalog/indice.py` — dataclasses do índice e `obter_indice()`.
- `server/app/features/catalog/semelhanca.py` — funções puras de normalização e pontuação.
- `server/app/features/catalog/busca.py` — filtros, ranking, facetas e paginação (puro sobre o índice) + `buscar()`.
- `dialect.py`, `schemas.py`, `controller.py`, `service.py` — recebem os acréscimos descritos nas tasks.
- Front: `web/src/hooks/queries/busca.ts`, `web/src/components/{busca-catalogo,filtros-busca,busca-global}.tsx`, ajustes em `pages/catalogo.tsx` e `layouts/app-layout.tsx`.

---

### Task 1: Medir o catálogo

**Files:**
- Modify: `server/app/features/catalog/dialect.py` (campo `contagem_sql`)
- Create: `server/scripts/medir_catalogo.py`
- Test: `server/tests/test_catalog_source.py`, `server/tests/test_medir_catalogo.py`

**Interfaces:**
- Produces: `Dialect.contagem_sql: str` — uma linha com `QTD_SCHEMAS`, `QTD_TABELAS`, `QTD_COLUNAS` (tabelas e views, sem schemas de sistema, mesmos filtros de `schemas_sql`); `medir() -> dict[str, int]` (chaves `schemas`, `tabelas`, `colunas`) em `scripts/medir_catalogo.py`, com `main()` que imprime as três contagens.

- [ ] **Step 1: Write the failing tests:** `test_contagem_sql_db2` e `test_contagem_sql_postgres` (uma consulta, sem parâmetro, as três chaves em maiúsculas); `test_medir_devolve_as_tres_contagens` (`query` simulado devolve `[{"QTD_SCHEMAS": 3, "QTD_TABELAS": 40, "QTD_COLUNAS": 900}]` → `{"schemas": 3, "tabelas": 40, "colunas": 900}`).
- [ ] **Step 2:** Run `uv run pytest tests/test_catalog_source.py tests/test_medir_catalogo.py -v` — Expected: FAIL.
- [ ] **Step 3: Implementar** o SQL dos dois dialetos e o script (usa `catalog_db.query` e `get_dialect()`).
- [ ] **Step 4:** Run o mesmo comando — Expected: PASS.
- [ ] **Step 5: Verificação manual (pessoa com acesso ao banco, não o executor automático):** `cd server && uv run python scripts/medir_catalogo.py` contra a fonte real; anotar os três números em `docs/medicao-catalogo.md` (data, fonte, contagens) e ajustar `CATALOG_INDEX_MAX_COLUMNS` para ~2x a contagem de colunas se ela passar de 1 milhão. O executor automático registra "medição pendente" no relatório e segue com os defaults.
- [ ] **Step 6: Commit** `feat: script de medição do tamanho do catálogo`.

### Task 2: Consultas do catálogo inteiro

**Files:**
- Modify: `server/app/features/catalog/dialect.py`
- Test: `server/tests/test_catalog_source.py`

**Interfaces:**
- Produces: `Dialect.todas_tabelas_sql: str` (linhas `TABSCHEMA, TABNAME, TYPE` 'T'/'V', `REMARKS`) e `Dialect.todas_colunas_sql: str` (linhas `TABSCHEMA, TABNAME, COLNAME, TYPENAME, LENGTH, SCALE, COLNO, REMARKS`), sem parâmetros, ordenadas por schema, tabela e `COLNO`; mesmos filtros de objetos e de schemas de sistema que `schemas_sql`/`tables_sql`; `LENGTH`/`SCALE` com a mesma lógica de `columns_sql` (Postgres: `varchar`/`numeric` via `atttypmod`).

- [ ] **Step 1: Write the failing tests:** para `db2` e `postgres` (`patch.object(settings, "CATALOG_SOURCE", ...)`): as duas strings existem, não têm `?`, citam as chaves acima em maiúsculas; a de colunas do Postgres contém a mesma expressão `format_type(a.atttypid, NULL)` de `columns_sql`.
- [ ] **Step 2:** Run `uv run pytest tests/test_catalog_source.py -v` — Expected: FAIL.
- [ ] **Step 3: Implementar** as duas consultas nos dois dialetos, espelhando `columns_sql`, `tables_sql` e `_db2_busca_colunas`.
- [ ] **Step 4:** Run o mesmo comando — Expected: PASS.
- [ ] **Step 5: Commit** `feat: consultas de tabelas e colunas de todo o catálogo`.

### Task 3: Regra única de conformidade e índice do catálogo

**Files:**
- Create: `server/app/features/catalog/conformidade.py`, `server/app/features/catalog/indice.py`
- Modify: `server/app/features/catalog/service.py` (as duas rotas de cálculo passam a usar a regra única), `server/app/config.py`, `server/tests/conftest.py`, `server/app/main.py` (aquecimento no `lifespan`)
- Test: `server/tests/test_catalog_indice.py`, `server/tests/test_catalog_service.py` (devem continuar verdes sem alterar suas asserções)

**Interfaces:**
- Produces (`catalog/conformidade.py`): `avaliar_colunas(schema_name: str, colunas: Sequence[tuple[str, str, int | None]]) -> tuple[list[Avaliacao | None], Resumo]` — `colunas` são `(nome, tipo, tamanho)`; devolve uma avaliação por coluna, na mesma ordem (`None` para coluna de auditoria e para qualquer coluna de schema LEGADO) e o `Resumo` da tabela (`resumo_nao_aplicavel()` em schema LEGADO; auditoria fora da conta). O detalhe usa as duas partes do retorno; a lista e o índice usam só o resumo.
- Produces (`indice.py`): dataclasses `ColunaIdx(nome, tipo, tamanho, descricao, tokens)`, `TabelaIdx(schema, nome, tipo, descricao, classificacao, camada, dominio_code, dominio_nome, colunas: list[ColunaIdx], conformidade: Resumo, documentacao_percentual: int | None, tokens_nome)`, `IndiceCatalogo(tabelas: list[TabelaIdx])` e `async obter_indice() -> IndiceCatalogo` com `@ttl_cache("CATALOG_INDEX_TTL_SECONDS")`. `tokens`/`tokens_nome` vêm de `semelhanca.tokens_de_nome` (Task 4 — aqui pode ser uma função mínima `nome.upper().split("_")` trocada na Task 4).
- Falhas: mais colunas que `CATALOG_INDEX_MAX_COLUMNS` → `HTTPException(503, "Catálogo grande demais para indexar: ...")`; `CatalogPermissionError` na montagem → 503 com mensagem legível. O tamanho do índice (tabelas/colunas) é logado uma vez ao montar.

- [ ] **Step 1: Write the failing tests:** em `test_catalog_indice.py` (com `query` simulado respondendo às duas consultas da Task 2 e `list_schemas` mocado): `test_indice_agrupa_colunas_por_tabela`; `test_indice_infere_camada_dominio_e_classificacao` (`CUR_COM`, `Classificação: RESTRITO` em `REMARKS`); `test_indice_legado_nao_aplicavel`; `test_indice_ignora_auditoria_no_resumo`; `test_indice_documentacao_percentual` (2 de 4 → 50; só auditoria → `None`); `test_indice_acima_do_limite_da_503` (monkeypatch `CATALOG_INDEX_MAX_COLUMNS=1`); `test_indice_sem_permissao_da_503`. Em `test_catalog_service.py`, nada novo: a suíte existente prova que lista e detalhe continuam iguais.
- [ ] **Step 2:** Run `uv run pytest tests/test_catalog_indice.py -v` — Expected: FAIL.
- [ ] **Step 3: Implementar** `catalog/conformidade.py` e **trocar** os dois laços duplicados de `service.py` (`_avaliar_conformidade` do detalhe e o da lista) para chamarem `avaliar_colunas` — este passo elimina a duplicação que a revisão final deixou registrada. Implementar o índice, os campos de `Settings`, o `conftest` e o aquecimento no `lifespan` (dentro de `try/except`, nunca derruba a subida).
- [ ] **Step 4:** Run `DEV_AUTH_BYPASS=false uv run pytest -q && uv run ruff check . && uv run pyright .` — Expected: tudo verde (os 2 erros antigos de `tests/test_access_gate.py` no pyright são conhecidos).
- [ ] **Step 5: Commit** `feat: índice do catálogo e regra única de conformidade`.

### Task 4: Semelhança

**Files:**
- Create: `server/app/features/catalog/semelhanca.py`
- Modify: `server/app/features/catalog/indice.py` (usa `tokens_de_nome`)
- Test: `server/tests/test_catalog_semelhanca.py`

**Interfaces:**
- Consumes: `carregar_regras().termos` (termo → código de prefixo, ex.: `COD` → `CD`).
- Produces: `normalizar_busca(texto: str) -> tuple[str, ...]` (maiúsculas, sem acento, separa por qualquer não alfanumérico, descarta `DE DO DA DOS DAS E O A OS AS` e tokens vazios); `tokens_de_nome(nome: str) -> tuple[str, ...]` (mesma normalização, separando também por `_`); `pontuar(termo: str, alvo: str) -> float` entre 0 e 1 (`alvo` é um nome de coluna/tabela); `rotulo(similaridade: float) -> Literal["forte", "medio", "fraco"]` usando os limiares de `Settings`. A pontuação combina cobertura dos tokens do termo (igual, prefixo de token com 3+ letras, ou erro de digitação pequeno) e o peso dos tokens do alvo que sobraram; um token do termo que está em `termos` também casa com o código de prefixo correspondente. O algoritmo exato e os pesos ficam com quem implementa; os testes abaixo fixam o comportamento.

- [ ] **Step 1: Write the failing tests:** `normalizar_busca("Cód. do Fornecédor")` → `("COD", "FORNECEDOR")`; `normalizar_busca("de do")` → `()`; `tokens_de_nome("CD_FORNECEDOR")` → `("CD", "FORNECEDOR")`; `pontuar("CD_FORNECEDOR", "CD_FORNECEDOR") == 1.0`; `pontuar("cód. fornecedor", "CD_FORNECEDOR")` ≥ limiar forte; `pontuar("fornecedor", "CD_FORNECEDOR")` ≥ limiar médio **e** menor que o do caso anterior; `pontuar("fornec", ...)` ≥ médio; `pontuar("fornecdor", ...)` ≥ médio; `pontuar("cliente", "CD_FORNECEDOR")` < médio; `pontuar("FORNECEDOR", ...) == pontuar("fornecédor", ...)`; `rotulo(0.9) == "forte"`, `rotulo(0.7) == "medio"`, `rotulo(0.2) == "fraco"` (e o rótulo acompanha o limiar quando o `Settings` é alterado por monkeypatch); `pontuar("", "CD_X") == 0.0` sem exceção.
- [ ] **Step 2:** Run `uv run pytest tests/test_catalog_semelhanca.py -v` — Expected: FAIL.
- [ ] **Step 3: Implementar** o módulo e trocar a função mínima de tokens do índice por `tokens_de_nome`.
- [ ] **Step 4:** Run `uv run pytest tests/test_catalog_semelhanca.py tests/test_catalog_indice.py -v` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: semelhança entre termo de busca e nomes do catálogo`.

### Task 5: Busca, filtros e facetas (API)

**Files:**
- Create: `server/app/features/catalog/busca.py`
- Modify: `server/app/features/catalog/schemas.py`, `controller.py`, `service.py`; `server/tests/test_routes_auth.py` (entrada em `ROTAS`)
- Test: `server/tests/test_catalog_busca.py`, `server/tests/test_catalog_search_api.py`

**Interfaces:**
- Consumes: `obter_indice()`, `pontuar`, `normalizar_busca`, `rotulo`, `Resumo`.
- Produces (`busca.py`): `FiltrosBusca(camada: tuple[str, ...] = (), dominio: tuple[str, ...] = (), classificacao: tuple[str, ...] = (), conformidade: tuple[str, ...] = (), com_descricao: bool = False, schemas: tuple[str, ...] = (), tipo: str | None = None)`; `buscar(indice: IndiceCatalogo, termo: str, filtros: FiltrosBusca, pagina: int, por_pagina: int) -> ResultadoBusca` (puro, sem I/O). `service.buscar_catalogo(...)` obtém o índice e delega.
- Produces (JSON): `GET /api/catalog/search?q=&camada=&dominio=&classificacao=&conformidade=&com_descricao=&filter=&tipo=&pagina=&por_pagina=` (multivalorados em lista separada por vírgula, como o `filter` existente; `filter` filtra por nome de schema; `pagina` começa em 1; `por_pagina` padrão 25, limitado a `CATALOG_SEARCH_PAGE_SIZE_MAX`) → `{total, pagina, por_pagina, resultados: [{schema_name, table, type, description, classification, camada, dominio: {code, name}, total_colunas, conformidade: ConformidadeOut, documentacao_percentual, similaridade: float | null, rotulo: "forte" | "medio" | "fraco" | null, colunas_encontradas: [{name, type, description, similaridade}] (até 3)}], facetas: {camada, dominio, classificacao, conformidade: [{valor, rotulo, qtd}]}}`.
- Regras: sem termo (ou só palavras vazias) → sem ranking, `similaridade`/`rotulo` nulos, ordem por schema e tabela. Com termo → pontua nome da tabela, sua descrição e cada coluna; a tabela entra se o melhor ponto for ≥ `SIMILARIDADE_LIMIAR_MEDIO`; ordem por similaridade decrescente e, no empate, schema e tabela. `conformidade` aceita `alta` (≥ `CONFORMIDADE_FAIXA_ALTA`), `media` (≥ `CONFORMIDADE_FAIXA_MEDIA`), `baixa` e `na` (não aplicável); só `na` inclui tabelas LEGADO. Facetas: a contagem de cada faceta considera todos os filtros **menos o dela mesma**.

- [ ] **Step 1: Write the failing tests** (índice montado à mão em `test_catalog_busca.py`; rota com `buscar_catalogo` mocado em `test_catalog_search_api.py`): sem termo nem filtro lista tudo ordenado e paginado; `termo="cód. fornecedor"` põe `CUR_CPR.FORNECEDOR` primeiro com `rotulo="forte"` e `colunas_encontradas[0].name == "CD_FORNECEDOR"`; termo só `"de do"` = sem termo; cada filtro isolado; `camada=CUR,STG` soma; `camada=XYZ` → `total == 0` sem erro; `conformidade=alta` exclui LEGADO e `conformidade=na` só traz LEGADO; `com_descricao`; `pagina=99` → lista vazia e `total` correto; `por_pagina=9999` vira o máximo; faceta de camada com `camada=CUR` ainda mostra `STG` com a contagem certa; a rota responde 401 sem sessão e 200 com sessão (entrada nova em `ROTAS`); `por_pagina=0` e `pagina=0` → 422.
- [ ] **Step 2:** Run `uv run pytest tests/test_catalog_busca.py tests/test_catalog_search_api.py tests/test_routes_auth.py -v` — Expected: FAIL.
- [ ] **Step 3: Implementar** `busca.py`, os schemas pydantic, o serviço e a rota. A rota `GET /search` precisa ficar **antes** das rotas com parâmetro de caminho, como `/columns/search` já faz.
- [ ] **Step 4:** Run `DEV_AUTH_BYPASS=false uv run pytest -q && uv run ruff check . && uv run pyright .` — Expected: verde.
- [ ] **Step 5: Commit** `feat: busca global do catálogo com filtros e facetas`.

### Task 6: Front — dados da busca

**Files:**
- Create: `web/src/hooks/queries/busca.ts`
- Test: `web/src/tests/busca-mapping.test.ts`

**Interfaces:**
- Consumes: JSON da Task 5; tipos `Conformidade` de `@/hooks/queries/nomenclatura`.
- Produces: `FiltrosBusca { camada: string[]; dominio: string[]; classificacao: string[]; conformidade: string[]; comDescricao: boolean; schemas: string[]; tipo: string | null }`; `ParametrosBusca { q: string; filtros: FiltrosBusca; pagina: number; porPagina: number }`; `ResultadoBusca { total; pagina; porPagina; resultados: ItemBusca[]; facetas: Facetas }`; `mapBusca(raw)` (exportado); `useCatalogSearch(params: ParametrosBusca)` (query com `placeholderData: keepPreviousData`, `staleTime` de 1 min, `retry: false`); `paramsDaUrl(search: URLSearchParams): ParametrosBusca` e `paramsParaUrl(p: ParametrosBusca): URLSearchParams` (omitem valores vazios/padrão; `paramsParaUrl(paramsDaUrl(x))` devolve o mesmo conjunto).

- [ ] **Step 1: Write the failing tests:** `mapBusca` converte `schema_name`, `colunas_encontradas`, `total_colunas`, `documentacao_percentual` e mantém `similaridade: null`; `paramsDaUrl("?q=cod&camada=CUR,STG&pagina=2")` → filtros e página esperados; ida e volta de `paramsParaUrl`; `pagina` inválida (`abc`, `0`) → 1.
- [ ] **Step 2:** Run `npx vitest run src/tests/busca-mapping.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implementar** o hook e os conversores.
- [ ] **Step 4:** Run o mesmo comando e `npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): hook e tipos da busca do catálogo`.

### Task 7: Front — aba "Buscar" no catálogo

**Files:**
- Create: `web/src/components/busca-catalogo.tsx`, `web/src/components/filtros-busca.tsx`
- Modify: `web/src/pages/catalogo.tsx` (abas), `web/src/tests/pages-catalogo.test.tsx` (só o necessário para as abas)
- Test: `web/src/tests/pages-busca.test.tsx`

**Interfaces:**
- Consumes: `useCatalogSearch`, `paramsDaUrl`, `paramsParaUrl` (Task 6); `SeloConformidade` e `StatusBadge` existentes; `usePagination` **não** (a paginação é do servidor: `Table`/botões anterior/próxima com `pagina`).
- Produces: `FiltrosBusca({ facetas, valor, aoMudar })` (grupos de checkbox por faceta com a contagem, mais "Só com descrição"; recolhível com `Collapsible`, e dentro de um `Sheet` em tela estreita via `useIsBelowBreakpoint`); `BuscaCatalogo()` (campo grande de busca com debounce de 300 ms usando `useDebouncedValue`, resultados em lista com nome `schema.tabela` como link para `/catalogo/{schema}/{tabela}`, selos de camada/domínio/conformidade, e, quando há termo, o rótulo de similaridade e "coluna encontrada: ..."); abas do `/catalogo`: "Buscar" (padrão) e "Schemas" (o conteúdo atual da página, intacto). A aba padrão é "Schemas" quando a URL tem `filter` ou `tipo` (links do Scanner). O estado vive na URL (`q`, filtros, `pagina`, `aba`).

- [ ] **Step 1: Write the failing tests** (`api.get` mocado, payloads em `snake_case`): digitar `cód. fornecedor` chama `/catalog/search` com `q` e mostra `CUR_CPR.FORNECEDOR` com "forte"; marcar a faceta `CUR` põe `camada=CUR` na URL e na chamada; `Só com descrição`; enquanto carrega a primeira busca mostra o esqueleto e **não** "Nenhum resultado"; zero resultados mostra "Nenhum resultado" com a dica de limpar os filtros; erro 503 do BFF mostra a mensagem recebida (`QueryError`); `?filter=CUR_COM` abre a aba "Schemas"; os testes antigos de `Catálogo`/`Scanner` continuam passando.
- [ ] **Step 2:** Run `npx vitest run src/tests/pages-busca.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implementar** os componentes e as abas.
- [ ] **Step 4:** Run `npm run lint && npm run test && npm run build` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): aba Buscar no catálogo com filtros e similaridade`.

### Task 8: Front — atalho Ctrl+K

**Files:**
- Create: `web/src/components/busca-global.tsx`
- Modify: `web/src/layouts/app-layout.tsx`
- Test: `web/src/tests/busca-global.test.tsx`, e atualização do `CLAUDE.md` (seção "Nomenclatura e conformidade": acrescentar busca, índice, faixas e `GET /api/catalog/search`; remover o item correspondente de "Not built yet")

**Interfaces:**
- Produces: `BuscaGlobal()` montado no layout: `Ctrl+K` (e `⌘K`) abre um `Sheet` com um campo de busca; `Enter` navega para `/catalogo?aba=buscar&q=<termo>` e fecha; `Esc` fecha; o atalho funciona em qualquer lugar da tela, inclusive com o foco num campo de texto, e usa `preventDefault` para não abrir a busca do navegador; botão visível com ícone no topo do layout para quem não usa teclado.

- [ ] **Step 1: Write the failing tests:** `Ctrl+K` abre o campo (foco automático); digitar `fornecedor` + `Enter` navega para `/catalogo?aba=buscar&q=fornecedor`; `Esc` fecha; o botão do topo também abre.
- [ ] **Step 2:** Run `npx vitest run src/tests/busca-global.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implementar** o componente, o botão e o `CLAUDE.md`.
- [ ] **Step 4: Verificação final.** `web/`: `npm run lint && npm run test && npm run build`; `server/`: `DEV_AUTH_BYPASS=false uv run pytest -q && uv run ruff check . && uv run pyright .` — Expected: tudo verde. Conferir à mão no `npm run dev` (com o servidor em porta livre): busca a frio com o índice montando, filtros, Ctrl+K.
- [ ] **Step 5: Commit** `feat(web): atalho Ctrl+K de busca global`.
