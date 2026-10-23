# Nomenclatura e Conformidade (fases 1 e 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a página "Padrões de Nomenclatura" com validador e o selo de conformidade com a nomenclatura Morlan no detalhe da tabela e na lista de tabelas do schema.

**Architecture:** Um módulo novo `server/app/features/nomenclatura/` guarda as regras (JSON gerado das referências da skill SKTIARQ0001, copiadas em `docs/nomenclatura-fonte/`) e a avaliação de conformidade. O `catalog` consome essa avaliação em memória, sem nova consulta de dados (só metadados). O front ganha a rota `/nomenclatura` e os selos.

**Tech Stack:** FastAPI + pydantic + pytest (`server/`), React 19 + TanStack Query + `@morlan/ui` + Vitest (`web/`).

**Spec:** `docs/superpowers/specs/2026-10-23-portal-consulta-nomenclatura-design.md` (seções 3.1, 3.2 e 6). Fica para outro plano: seção 3.3 (busca/filtros), 3.4 (API da skill), fases 3 a 5, a coluna "No catálogo" da aba de prefixos e o painel lateral de coluna.

## Global Constraints

- Comandos de servidor rodam em `server/` com `uv run`; do front, em `web/` com `npx vitest run <arquivo>`.
- JSON da API em `snake_case`; o front converte para camelCase nos hooks de `web/src/hooks/queries/` (tipo "raw" + mapper).
- Texto da interface em português com acentuação; componentes do `@morlan/ui` antes de criar os próprios.
- Testes offline: `query` do catálogo é simulado, nada contata DB2/Postgres. Funcionam para `CATALOG_SOURCE=db2` e `postgres`.
- Toda rota nova usa `Depends(get_current_user)` e entra em `ROTAS` de `server/tests/test_routes_auth.py`.
- Parâmetros ficam em `app/config.py`, não no código: `CONFORMIDADE_PESO_AVISO: float = 0.5`.
- Conformidade: conforme vale 1, aviso 0,5, fora do padrão 0, sobre colunas de negócio (sem `AUDIT_COLUMNS`); percentual com `round_half_up`.
- Schemas LEGADO (`infer_camada(...) == "LEGADO"`): conformidade "não aplicável" (`aplicavel=false`, colunas sem avaliação).
- Prefixos `NR_`, `VL_`, `VR_`, `PC_`, `QT_`, `LEG_`, `VLX_` não têm domínio de tipo: valida só o prefixo.
- Tipos comparados por família (`texto`, `inteiro`, `decimal`, `data`, `hora`, `data_hora`, `booleano`, `outro`), nunca pelo nome exato do banco. Família diferente → fora; mesma família com tamanho diferente → aviso.
- Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Nome vazio, só prefixo (`"CD_"`, `"CD"`) ou sem sublinhado → "fora do padrão", nunca exceção. (Task 2)
- Nome em minúsculas (Postgres), com acento ou espaços → avaliado como o equivalente em maiúsculas. (Task 3)
- `IN_*` como `CHAR(1)` no DB2 (que não tem boolean) → conforme, não "fora". (Task 2)
- Tabela só com colunas de auditoria → `total=0`, `percentual=None`, sem divisão por zero. (Task 2, 5)
- Tabela com `leitura_negada` → a conformidade (só metadados) continua aparecendo. (Task 5)

## File Structure

- `docs/nomenclatura-fonte/*.md` (já existe) → fonte; `server/app/features/nomenclatura/regras.json` → gerado.
- `server/app/features/nomenclatura/geracao.py` — lê a fonte e produz o dict do JSON. `server/scripts/gerar_regras_nomenclatura.py` — linha de comando.
- `.../regras.py` — dataclasses e `carregar_regras()`. `.../conformidade.py` — avaliação e resumo. `.../service.py` — `validar_nome`. `.../schemas.py` + `.../controller.py` — API.
- `server/app/features/catalog/` — recebe `conformidade` em colunas, tabela e lista (`schemas.py`, `service.py`, `dialect.py`).
- `web/src/hooks/queries/nomenclatura.ts`, `web/src/components/{validador-nome,selo-conformidade}.tsx`, `web/src/pages/nomenclatura.tsx`.

---

### Task 1: Regras — geração e carga

**Files:**
- Create: `server/app/features/nomenclatura/{__init__,geracao,regras}.py`, `server/app/features/nomenclatura/regras.json`, `server/scripts/gerar_regras_nomenclatura.py`
- Test: `server/tests/test_nomenclatura_regras.py`

**Interfaces:**
- Produces (`regras.py`): dataclasses congeladas `Prefixo(codigo, significado, exemplo, dominios: tuple[str, ...])` (código **sem** sublinhado, ex.: `"CD"`), `DominioTipo(codigo, descricao, tipo, escala: str | None, nulo: bool, exemplo)`, `Ambiguidade(termos: tuple[str, ...], opcoes: tuple[str, ...], pergunta: str)`, `Regras(fonte, versao, data_fonte, prefixos: dict[str, Prefixo], dominios_tipo: dict[str, DominioTipo], dominios_negocio: dict[str, str], termos: dict[str, str], ambiguidades: tuple[Ambiguidade, ...])` e `carregar_regras() -> Regras` (com `functools.cache`).
- Produces (`geracao.py`): `gerar_regras(pasta_fonte: Path, versao: str, data_fonte: str) -> dict`.
- `termos`: termo normalizado (maiúsculas, sem acento) → código de prefixo, só das linhas sem parênteses da tabela "Mapeamento semântico" (ex.: `"COD" → "CD"`, `"DESCRICAO" → "DS"`).
- Domínios de um prefixo: os domínios cujo código é igual ao do prefixo ou começa com `código + "_"`.

- [ ] **Step 1: Write the failing tests** em `test_nomenclatura_regras.py` (pula com `pytest.skip` se `docs/nomenclatura-fonte` não existir): `test_conta_itens_da_fonte` (20 prefixos incluindo `LEG` e `VLX`, 21 domínios de tipo, 24 domínios de negócio); `test_prefixo_cd_tem_dois_dominios` (`("CD_INT","CD_VAR")`), `test_prefixo_ds_tem_tres`, `test_prefixos_sem_dominio` (`NR`, `VL`, `VR`, `PC`, `QT`, `LEG`, `VLX` → `()`); `test_termo_cod_aponta_para_cd`; `test_json_esta_em_dia` (`gerar_regras(...)` com a versão e data do próprio JSON == conteúdo de `regras.json`).
- [ ] **Step 2:** Run `uv run pytest tests/test_nomenclatura_regras.py -v` — Expected: FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar `geracao.py` e `regras.py`.** O parser lê as tabelas markdown dos três arquivos; `nulo` = `S`/`N`; `escala` `"—"` vira `None`. Ambiguidades vêm da tabela "Termos ambíguos" (termos separados por vírgula ou `/`, opções = códigos entre crases).
- [ ] **Step 4: Gerar o JSON:** `uv run python scripts/gerar_regras_nomenclatura.py --versao 0.2.0 --data-fonte 2026-08-04` (grava `regras.json`; os dois argumentos são obrigatórios, nada fixo no código).
- [ ] **Step 5:** Run `uv run pytest tests/test_nomenclatura_regras.py -v` — Expected: PASS.
- [ ] **Step 6: Commit** `feat: regras de nomenclatura geradas da skill SKTIARQ0001`.

### Task 2: Avaliação de coluna e resumo

**Files:**
- Create: `server/app/features/nomenclatura/conformidade.py`
- Modify: `server/app/config.py` (`CONFORMIDADE_PESO_AVISO`)
- Test: `server/tests/test_nomenclatura_conformidade.py`

**Interfaces:**
- Consumes: `carregar_regras()` (Task 1); `round_half_up` de `app.features.catalog.inference`.
- Produces: `Familia`, `familia_do_tipo(tipo: str) -> Familia`; `Resultado = Literal["conforme","aviso","fora"]`; `Sugestao(nome, dominio, tipo, nulo)` (todos opcionais); `Avaliacao(resultado, problemas: tuple[str, ...], sugestao: Sugestao | None)`; `avaliar_coluna(nome: str, tipo: str | None, tamanho: int | None = None) -> Avaliacao`; `Resumo(aplicavel, conformes, avisos, fora, total, percentual: int | None)`; `resumir(avaliacoes: Iterable[Avaliacao]) -> Resumo`; `resumo_nao_aplicavel() -> Resumo`.
- Regras: prefixo = primeiro trecho do nome antes de `_`; nome sem prefixo reconhecido → `fora` com `sugestao.nome` trocando o trecho inicial pelo prefixo de `regras.termos` (`COD_FORNEC` → `CD_FORNEC`); `tipo=None` valida só o prefixo; com vários domínios candidatos é conforme se bate com **qualquer** um, senão avalia contra o primeiro da mesma família (tamanho diferente → `aviso`). `tamanho` só é comparado em família `texto` e escala numérica do domínio.

- [ ] **Step 1: Write the failing tests:**
  - `familia_do_tipo`: `"VARCHAR"`, `"character varying"`, `"CHARACTER"` → `texto`; `"INTEGER"`, `"bigint"` → `inteiro`; `"DECIMAL"`, `"numeric"` → `decimal`; `"timestamp without time zone"` → `data_hora`; `"boolean"` → `booleano`.
  - `avaliar_coluna("CD_FORNECEDOR","VARCHAR",20).resultado == "conforme"`; com `tamanho=10` → `aviso`; `avaliar_coluna("COD_FORNEC","VARCHAR",10)` → `fora`, `sugestao.nome == "CD_FORNEC"`.
  - `avaliar_coluna("CD_PRODUTO","INTEGER")` → `conforme` (casa com `CD_INT`); `("NM_CLIENTE","INTEGER")` → `fora`.
  - Review Focus: `avaliar_coluna("", "VARCHAR")`, `("CD_","VARCHAR")`, `("CD","VARCHAR")` → `fora`, sem exceção; `avaliar_coluna("IN_ATIVO","CHARACTER",1).resultado == "conforme"` e `("IN_ATIVO","boolean")` → `conforme`.
  - `resumir`: 2 conformes + 1 aviso + 1 fora → `percentual == 63` (62,5 arredondado para cima); `resumir([])` → `total == 0` e `percentual is None`; `resumo_nao_aplicavel().aplicavel is False`.
- [ ] **Step 2:** Run `uv run pytest tests/test_nomenclatura_conformidade.py -v` — Expected: FAIL.
- [ ] **Step 3: Implementar** os símbolos acima em `conformidade.py` e o campo em `Settings`. A família do domínio vem da coluna `tipo` de `dominios_tipo` (`INTEGER`→inteiro, `VARCHAR`/`TEXT`→texto, `DATE`→data, `TIME`→hora, `TIMESTAMP`→data_hora, `BOOLEAN`→booleano). `booleano` aceita também `texto` de tamanho 1.
- [ ] **Step 4:** Run o mesmo comando — Expected: PASS.
- [ ] **Step 5: Commit** `feat: avaliação de conformidade de coluna com a nomenclatura`.

### Task 3: Validador de nome livre

**Files:**
- Create: `server/app/features/nomenclatura/service.py`
- Test: `server/tests/test_nomenclatura_validador.py`

**Interfaces:**
- Consumes: `avaliar_coluna`, `carregar_regras` (Tasks 1–2).
- Produces: `Validacao(nome: str, avaliacao: Avaliacao, ambiguidade: Ambiguidade | None, dominios_candidatos: tuple[str, ...])`; `validar_nome(nome: str, tipo: str | None = None, tamanho: int | None = None) -> Validacao`.
- Regras: normaliza o nome (strip, maiúsculas, sem acento, espaços → `_`) antes de tudo. `ambiguidade` preenchida quando o primeiro trecho do nome é exatamente um termo de uma `Ambiguidade` (ex.: `NUMERO_NOTA`); abreviações (`COD`, `NUM`) **não** disparam. `dominios_candidatos` só vem preenchido quando `tipo is None` e o prefixo tem mais de um domínio; se `tipo` casa com exatamente um candidato, fica vazio.

- [ ] **Step 1: Write the failing tests:** `test_normaliza_minusculas_acento_e_espaco` (`" cód fornec "` e `"cd_fornec"` avaliados como `CD_...`; Review Focus); `test_numero_dispara_ambiguidade` (`NUMERO_NOTA` → `opcoes` contém `NR` e `CD`); `test_cod_nao_dispara_ambiguidade`; `test_cd_sem_tipo_pergunta_dominio` (`dominios_candidatos == ("CD_INT","CD_VAR")`); `test_cd_com_varchar_nao_pergunta`.
- [ ] **Step 2:** Run `uv run pytest tests/test_nomenclatura_validador.py -v` — Expected: FAIL.
- [ ] **Step 3: Implementar** `validar_nome` e a normalização em `service.py`.
- [ ] **Step 4:** Run o mesmo comando — Expected: PASS.
- [ ] **Step 5: Commit** `feat: validador de nome de coluna com desambiguação`.

### Task 4: API de nomenclatura

**Files:**
- Create: `server/app/features/nomenclatura/{schemas,controller}.py`
- Modify: `server/tests/test_routes_auth.py` (entradas em `ROTAS`), `server/app/features/catalog/reference.py` e `inference.py` (ver Step 4)
- Test: `server/tests/test_nomenclatura_api.py`

**Interfaces:**
- Consumes: `carregar_regras`, `validar_nome`.
- Produces (JSON, `snake_case`): `GET /api/nomenclatura` → `{fonte, versao, data_fonte, prefixos: [{codigo, significado, exemplo, dominios}], dominios_tipo: [{codigo, descricao, tipo, escala, nulo, exemplo}], dominios_negocio: [{codigo, nome}], camadas: [str], ambiguidades: [{termos, opcoes, pergunta}]}`. `POST /api/nomenclatura/validar` com `{nome, tipo?, tamanho?}` → `{nome, resultado, problemas, sugestao: {nome, dominio, tipo, nulo} | null, ambiguidade: {...} | null, dominios_candidatos}`. Pydantic: `NomenclaturaOut`, `ValidarNomeIn`, `ValidacaoOut`, `SugestaoOut`, `AvaliacaoOut` (reusado pelo catálogo).
- `camadas` = `CAMADAS_GOVERNADAS` de `catalog/reference.py`.

- [ ] **Step 1: Write the failing tests:** pelo cliente de `tests/helpers.py` — `test_get_nomenclatura_traz_20_prefixos_e_versao`; `test_validar_cod_fornec_sugere_cd`; `test_validar_exige_nome` (422 se faltar `nome`); as duas rotas respondem 401 sem sessão (entradas novas em `ROTAS`).
- [ ] **Step 2:** Run `uv run pytest tests/test_nomenclatura_api.py tests/test_routes_auth.py -v` — Expected: FAIL.
- [ ] **Step 3: Implementar** schemas e `controller.py` (`APIRouter(prefix="/nomenclatura", tags=["nomenclatura"])`, ambas com `Depends(get_current_user)`).
- [ ] **Step 4: Trocar a fonte do domínio de coluna.** `PREFIXO_DOMINIOS` em `reference.py` deixa de existir; `infer_prefix_domain(column_name)` passa a usar `carregar_regras().prefixos[...].significado` (continua devolvendo `NAO_CLASSIFICADO` se desconhecido). `LEG` e `VLX` passam a ser reconhecidos. Ajustar `tests/test_inference.py` onde cita o dicionário antigo.
- [ ] **Step 5:** Run `uv run pytest -q && uv run ruff check . && uv run pyright .` — Expected: tudo verde.
- [ ] **Step 6: Commit** `feat: API de nomenclatura e domínio de coluna vindo das regras`.

### Task 5: Conformidade e documentação no detalhe da tabela

**Files:**
- Modify: `server/app/features/catalog/schemas.py`, `server/app/features/catalog/service.py` (`get_table_detail`)
- Test: `server/tests/test_catalog_service.py`

**Interfaces:**
- Consumes: `avaliar_coluna`, `resumir`, `resumo_nao_aplicavel`, `infer_camada`, `is_audit_column`.
- Produces (JSON): `ColumnOut.conformidade: AvaliacaoOut | None` (`None` em coluna de auditoria ou schema legado); `TableDetailOut.conformidade: ConformidadeOut` com `{aplicavel, conformes, avisos, fora, total, percentual | null}`; `TableDetailOut.documentacao: {percentual: int | null, documentadas: int, total: int}` (colunas de negócio com `description` não vazia).
- Vale também com `leitura_negada=true` (só metadados).

- [ ] **Step 1: Write the failing tests** (estilo de `test_catalog_service.py`, `query` simulado): `test_detalhe_traz_conformidade_por_coluna_e_resumo`; `test_detalhe_legado_nao_aplicavel` (`conformidade.aplicavel is False`, colunas com `conformidade is None`); `test_tabela_so_com_auditoria_nao_divide_por_zero`; `test_leitura_negada_mantem_conformidade`; `test_documentacao_conta_so_colunas_de_negocio`.
- [ ] **Step 2:** Run `uv run pytest tests/test_catalog_service.py -v` — Expected: FAIL.
- [ ] **Step 3: Implementar** os campos novos e o cálculo em `get_table_detail`, sem mexer em `list_columns` (a avaliação é feita ao montar a resposta).
- [ ] **Step 4:** Run `uv run pytest -q && uv run ruff check . && uv run pyright .` — Expected: verde.
- [ ] **Step 5: Commit** `feat: conformidade e documentação no detalhe da tabela`.

### Task 6: Conformidade na lista de tabelas do schema

**Files:**
- Modify: `server/app/features/catalog/dialect.py`, `schemas.py`, `service.py`, `controller.py`; `server/tests/test_routes_auth.py` (alvo mocado da rota de tabelas)
- Test: `server/tests/test_catalog_source.py`, `test_catalog_service.py`

**Interfaces:**
- Produces: `Dialect.colunas_do_schema_sql: str` (param: schema; linhas `TABNAME, COLNAME, TYPENAME, LENGTH, SCALE`, só tabelas e views, mesmo formato nos dois bancos); `catalog_service.list_tables_com_conformidade(schema_name: str) -> list[TableOut]` (com `@ttl_cache("CATALOG_CACHE_TTL_SECONDS")`, uma consulta por schema); `TableOut.conformidade: ConformidadeOut | None = None`.
- `list_tables` continua existindo e inalterada; o controller `listar_tabelas` passa a chamar `list_tables_com_conformidade`. Schema legado → `conformidade = resumo_nao_aplicavel()`.

- [ ] **Step 1: Write the failing tests:** em `test_catalog_source.py`, `test_colunas_do_schema_sql_db2` e `_postgres` (uma consulta, parâmetro de schema, aliases em maiúsculas); em `test_catalog_service.py`, `test_lista_traz_resumo_por_tabela` (2 tabelas, resumos distintos) e `test_lista_legado_nao_aplicavel`; ajustar o alvo mocado em `ROTAS` para `list_tables_com_conformidade`.
- [ ] **Step 2:** Run `uv run pytest tests/test_catalog_source.py tests/test_catalog_service.py tests/test_routes_auth.py -v` — Expected: FAIL.
- [ ] **Step 3: Implementar** o SQL dos dois dialetos (espelhando `columns_sql`, sem filtro de tabela, junto de `TABNAME`), o serviço e o controller.
- [ ] **Step 4:** Run `uv run pytest -q && uv run ruff check . && uv run pyright .` — Expected: verde.
- [ ] **Step 5: Commit** `feat: conformidade por tabela na lista do schema`.

### Task 7: Front — dados e mapeamentos

**Files:**
- Create: `web/src/hooks/queries/nomenclatura.ts`
- Modify: `web/src/hooks/queries/catalog.ts` (campos novos em `ColumnRaw`/`TableDetailRaw`/`TableRaw` e nos mappers)
- Test: `web/src/tests/nomenclatura-mapping.test.ts`

**Interfaces:**
- Produces: `Avaliacao { resultado: "conforme"|"aviso"|"fora"; problemas: string[]; sugestao: { nome: string|null; dominio: string|null; tipo: string|null; nulo: boolean|null } | null }`; `Conformidade { aplicavel; conformes; avisos; fora; total; percentual: number|null }`; `Documentacao { percentual: number|null; documentadas; total }`; `Column.conformidade: Avaliacao | null`; `TableDetail.conformidade`, `TableDetail.documentacao`; `Table.conformidade: Conformidade | null`; `Nomenclatura`, `Validacao`; `mapNomenclatura(raw)`, `mapValidacao(raw)` (exportados); `useNomenclatura()` e `useValidarNome()` (mutation `{nome, tipo?, tamanho?}`).
- Consumes: JSON das Tasks 4–6.

- [ ] **Step 1: Write the failing tests:** `mapValidacao` converte `dominios_candidatos` → `dominiosCandidatos` e `sugestao: null` fica `null`; `mapNomenclatura` converte `data_fonte` → `dataFonte`; `mapTableDetail` (existente) agora mapeia `conformidade` e `documentacao`.
- [ ] **Step 2:** Run `npx vitest run src/tests/nomenclatura-mapping.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implementar** tipos, mappers e hooks (`useNomenclatura` com `staleTime` longo: as regras mudam raramente).
- [ ] **Step 4:** Run o mesmo comando mais `npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): hooks e tipos de nomenclatura e conformidade`.

### Task 8: Front — página Padrões de Nomenclatura

**Files:**
- Create: `web/src/components/validador-nome.tsx`, `web/src/pages/nomenclatura.tsx`
- Modify: `web/src/App.tsx` (rota `nomenclatura`, `handle: { title: "Padrões de Nomenclatura" }`), `web/src/components/navbar/index.tsx` (item "Nomenclatura")
- Test: `web/src/tests/pages-nomenclatura.test.tsx`

**Interfaces:**
- Consumes: `useNomenclatura`, `useValidarNome` (Task 7).
- Produces: `ValidadorNome()` (campo de nome, tipo opcional, botão "Validar"; mostra resultado, sugestão com botão de copiar, a pergunta quando há `ambiguidade` e os domínios candidatos como botões que reexecutam a validação com o tipo escolhido); `Nomenclatura()` página com o validador no topo e `Tabs` do `@morlan/ui`: Prefixos (com filtro de texto), Domínios de tipo, Domínios de negócio, Nome de schema (camadas + domínios), Casos ambíguos. Rodapé com "Fonte: SKTIARQ0001 v{versao} ({dataFonte})". Ícone do item de menu: um de `@hugeicons/core-free-icons` (conferir que o export existe).

- [ ] **Step 1: Write the failing tests** (`api.get/post` mocado como em `pages-catalogo.test.tsx`): `lista os prefixos e mostra a versão da fonte`; `validar COD_FORNEC mostra fora do padrão e a sugestão CD_FORNEC`; `nome ambíguo mostra a pergunta com as opções`; `o filtro de prefixos reduz a lista`.
- [ ] **Step 2:** Run `npx vitest run src/tests/pages-nomenclatura.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implementar** componente, página, rota e item de menu.
- [ ] **Step 4:** Run o mesmo comando — Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): página de padrões de nomenclatura com validador`.

### Task 9: Front — selos de conformidade

**Files:**
- Create: `web/src/components/selo-conformidade.tsx`
- Modify: `web/src/pages/catalogo-tabela.tsx`, `web/src/pages/catalogo-schema.tsx`, `web/src/utils/catalog.ts` (`somarConformidade`)
- Test: `web/src/tests/pages-conformidade.test.tsx`, `web/src/tests/utils-catalog.test.ts`

**Interfaces:**
- Produces: `SeloConformidade({ resultado }: { resultado: "conforme" | "aviso" | "fora" })` sobre `Badge` (✔ Conforme / ⚠ Aviso / ✖ Fora do padrão); `somarConformidade(tables: Table[]): Conformidade` (soma só tabelas com `aplicavel`; sem nenhuma → `aplicavel=false`).
- Detalhe da tabela: três cartões no topo (saúde dos dados, conformidade de nomes, documentação — com "Não aplicável (schema legado)" quando for o caso), coluna "Conformidade" com selo e sugestão abaixo, e um filtro "só não conformes". Lista do schema: coluna com o percentual por tabela e um resumo do schema no cabeçalho.

- [ ] **Step 1: Write the failing tests:** `somarConformidade` soma 2 tabelas e ignora a não aplicável; detalhe mostra `✖ Fora do padrão` e a sugestão `CD_FORNEC` na coluna `COD_FORNEC`; o filtro "só não conformes" esconde as colunas conformes; tabela legada mostra "Não aplicável"; lista do schema mostra o percentual da tabela.
- [ ] **Step 2:** Run `npx vitest run src/tests/pages-conformidade.test.tsx src/tests/utils-catalog.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implementar** componente, utilitário e as duas páginas.
- [ ] **Step 4: Verificação final.** Em `web/`: `npm run lint && npm run test && npm run build`; em `server/`: `uv run ruff check . && uv run pytest -q && uv run pyright .` — Expected: tudo verde. Abrir `/nomenclatura` e uma tabela real no `npm run dev` (com o server na porta livre) e conferir os selos.
- [ ] **Step 5: Commit** `feat(web): selos de conformidade no catálogo`.
