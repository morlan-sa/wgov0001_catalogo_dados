# Portal de Governança e Catálogo de Dados — Design (MVP de Homologação)

**Data:** 2026-07-27
**Autor:** Lucas Mortari + Claude
**Status:** Aguardando revisão do usuário

## Contexto

A Morlan já tem um modelo de governança de dados desenhado (schemas `CUR_GDA`
taxonomias e `CUR_CAT` catálogo de entidades/atributos/linhagem), hoje
especificado para rodar em PostgreSQL (`03_Schema_GDA/`), e um banco DB2 de
desenvolvimento (`mdb01` em `db2dev.morlan.local`) com ~57 schemas — misturando
schemas legados (COMPRAS, RCHUMANO, ESOCIAL, HEURYSSAP etc., centenas de
tabelas cada) com schemas que já seguem o padrão de governança
(`STG_ERP`, `STG_API`, `STG_CAT`, `CUR_COM`, `CUR_FIS`, `CUR_MKT`, `CUR_REF`,
`RPT_COM`, `RPT_FIS`, `RPT_MKT`, `RPT_REF`). Muitas tabelas nesses schemas já
têm `COMMENT` (REMARKS) ricos, inclusive citando classificação da informação
em texto livre (ex: "Classificacao: RESTRITO").

Objetivo deste projeto: construir um **portal web (React + JavaScript)** que
permita **navegar o catálogo de dados do DB2 dev** e **escanear** os
metadados desse banco — como prova de conceito de homologação. Após
validação, poderá ser reapontado para o DB2 de produção ou para o
PostgreSQL, sem retrabalho de telas.

**Atualização importante (pós-teste real no DB2 dev):** o usuário
`devlucas` **não tem privilégio `CREATE SCHEMA`** no DB2 dev, e também não
tem privilégio de escrita nos schemas já existentes (`CUR_COM`, `STG_CAT`,
`MDB01USR` etc. — foram criados por outro usuário/processo). Confirmado por
teste direto (`SQL0552N` ao tentar `CREATE SCHEMA`, `SQL0551N` ao tentar
`CREATE TABLE` nesses schemas). Diante disso, o usuário decidiu: **o portal
não escreve nada no banco** — nem cria schema, nem tabela, nem faz
INSERT/UPDATE. Tudo é feito com **SELECT direto nas tabelas de sistema do
DB2** (`SYSCAT.SCHEMATA`, `SYSCAT.TABLES`, `SYSCAT.COLUMNS`,
`SYSCAT.TABCONST`/`SYSCAT.KEYCOLUSE` para chave primária). O catálogo e o
scanner viram, na prática, **um navegador ao vivo dos metadados do DB2**,
sem nenhuma tabela própria de persistência nesta fase. Isso simplifica bastante
o projeto (nada de DDL, nada de seed, nada de upsert) e elimina qualquer
risco de escrita indevida no banco.

## Decisões já validadas com o usuário

1. **Banco de dados do MVP:** DB2 dev (`mdb01`), usando as credenciais já
   presentes em `C:\Morlan_Python\Explorar\.env` (`DB2_*`). O acesso ao banco
   fica isolado atrás de uma camada de repositório para facilitar apontar
   depois para DB2 produção ou PostgreSQL. **Somente leitura** — nenhuma
   escrita (DDL ou DML) é feita pelo portal.
2. **Escopo funcional do MVP:**
   - Catálogo de dados navegável (schemas → tabelas → colunas, lendo ao
     vivo de `SYSCAT.TABLES`/`SYSCAT.COLUMNS`, com descrição vinda do
     `REMARKS` já cadastrado no DB2 e classificação **inferida** por texto
     quando o comentário já seguir o padrão `Classificacao: X`).
   - Scanner (`/scanner`): tela de seleção de schemas (atalho
     governados/todos/manual) que alimenta a navegação do catálogo — como
     é tudo leitura direta, "escanear" aqui significa "consultar agora",
     não "gravar no banco".
   - **Fora de escopo nesta fase:** qualquer persistência própria de
     catálogo, CRUD de governança, e visualização de linhagem — ficam para
     uma fase 2, quando houver um schema com permissão de escrita definido.
3. **Escopo do scanner:** cobre todos os schemas do DB2, mas com
   filtro/seleção configurável na tela (o usuário escolhe o que escanear).
4. **Autenticação:** nenhuma nesta fase (uso interno/rede local). A
   integração real com AD fica para o projeto separado já em andamento
   (`05_LoginAD` / `95_Login_AD`).
5. **Visual/UX** (validado com mockups no companion visual):
   - Shell do app: **sidebar escura fixa** à esquerda (Dashboard, Catálogo,
     Scanner, Domínios — este último desabilitado/"em breve" nesta fase).
   - Catálogo: navegação **drill-down em página cheia** com breadcrumb
     (Catálogo → Schema → Tabela), não master-detail.
   - Scanner: **assistente em 2 passos** — passo 1 escolhe um atalho
     (Schemas governados / Todos os schemas / Escolher manualmente), passo 2
     confirma a lista final antes de rodar.
   - Kit visual: reaproveitar o padrão do `95_Login_AD`/`15_App_Login`
     (Tailwind CSS + primitivas Radix no estilo shadcn/ui + ícones
     `lucide-react`). MUI **não** será usado no MVP — o app de login usa MUI
     apenas para poucos componentes específicos; aqui vamos manter uma stack
     mais enxuta (Tailwind + Radix) para não carregar duas bibliotecas de
     componentes concorrentes. Cores/tipografia seguem a mesma paleta
     (azul-escuro `#1A3A5C` como cor primária, iguala ao `CLR_FACT` usado nos
     diagramas ER e ao cabeçalho de dicionário de dados da skill de
     governança).

## Arquitetura

```
21_Portal_Governança/
├── backend/                # API Node.js + Express (JavaScript, sem TS)
│   └── src/
│       ├── config/          # carrega .env (aponta pra C:\Morlan_Python\Explorar\.env)
│       ├── db/               # pool/conexão DB2 (ibm_db), só leitura
│       ├── repositories/      # schemasRepo, tablesRepo, columnsRepo (só SELECT em SYSCAT.*)
│       ├── services/          # inference.js — infere camada/domínio/classificação (puro, sem I/O)
│       ├── routes/            # /api/schemas, /api/catalog, /api/dashboard
│       └── server.js
├── frontend/                # React + Vite (JavaScript puro, .jsx)
│   └── src/
│       ├── components/       # Sidebar, Breadcrumb, Badge, DataTable, Wizard...
│       ├── pages/            # Dashboard, ScannerPage, CatalogSchemaPage, CatalogTablePage
│       ├── api/               # client fetch para o backend
│       └── App.jsx
└── docs/superpowers/specs/    # este documento
```

Fluxo de dados: **Frontend (React)** chama a **API REST do backend
(Express)**; o backend é o único que fala com o **DB2** (via `ibm_db`) — o
navegador nunca acessa o banco diretamente. Credenciais ficam só no backend,
lidas do `.env` existente (nunca copiadas para o frontend ou hardcoded).
Todas as queries do backend contra o DB2 são **SELECT** — nenhuma rota da
API executa DDL/DML.

## Fonte de metadados (sem persistência própria)

Não há mais `CUR_GDA`/`CUR_CAT` nem qualquer tabela criada pelo portal. Os
metadados vêm **direto das tabelas de sistema do DB2**:

- `SYSCAT.TABLES` — schema, nome da tabela/view, tipo (`T`/`V`), `REMARKS`
  (comentário/descrição já cadastrado no banco).
- `SYSCAT.COLUMNS` — nome da coluna, tipo físico, tamanho/escala,
  nulabilidade, ordem (`COLNO`), `REMARKS`.
- `SYSCAT.TABCONST` + `SYSCAT.KEYCOLUSE` — para identificar quais colunas
  compõem a chave primária de cada tabela.

Como é tudo lido ao vivo, "camada" e "domínio de negócio" (COM/FAT/FIN/...)
e "classificação da informação" (Público/Corporativo/Restrito/Sigiloso) são
**inferidos em memória, a cada request**, nunca gravados:

1. **Camada**: prefixo do schema (`STG_`, `CUR_`, `RPT_`) → camada
   correspondente; qualquer outro schema → `LEGADO`.
2. **Domínio de negócio**: sufixo do schema (ex: `CUR_COM` → `COM`,
   mapeado para o nome descritivo "Comercial" pela tabela de domínios da
   skill de governança — os mesmos 24 domínios cadastrados: COM, FAT, FIN,
   CST, CTB, FIS, CPR, SUP, EST, PRD, QUA, ENG, MAN, LOG, TRN, EXP, RHU,
   SST, CTR, AUD, GOV, TIN, MKT, IAM); se o sufixo não bater com nenhum →
   domínio "Não classificado".
3. **Classificação**: regex sobre o `REMARKS` da tabela procurando o
   padrão `Classifica(c|ç)?(a|ã)o:?\s*(PUBLICO|CORPORATIVO|RESTRITO|
   SIGILOSO)` (tolerante a acento/mojibake); se não encontrar, mostra
   "Não classificado" (sem inventar uma classificação).
4. **Tipo de objeto**: `Tabela` ou `View`, direto do `SYSCAT.TABLES.TYPE`.

Essas 3 funções de inferência (`inferCamada`, `inferDominio`,
`inferClassificacao`) são **funções puras** (string in → string out, sem
banco), o que as torna fáceis de testar isoladamente.

## Telas (Frontend)

1. **Dashboard** — cards com total de schemas/tabelas catalogadas, última
   execução do scanner, distribuição por classificação.
2. **Catálogo** (`/catalogo`) — lista de schemas com contagem de tabelas e
   busca; clique entra em `/catalogo/:schema` (lista de tabelas) e depois
   `/catalogo/:schema/:tabela` (detalhe: colunas, tipos, classificação,
   descrição), com breadcrumb no topo.
3. **Scanner** (`/scanner`) — assistente 2 passos, mas agora é 100% ao vivo
   (sem gravar nada):
   - Passo 1: atalho (Schemas governados / Todos / Manual) — busca a lista
     de schemas com contagem de tabelas via `GET /api/schemas`.
   - Passo 2: lista final com checkboxes (edita a seleção do atalho) +
     botão "Consultar"; ao confirmar, navega para `/catalogo` já filtrado
     pelos schemas escolhidos (passado por query string), onde a consulta
     de fato acontece.
4. **Domínios** (`/dominios`) — item no menu, mas desabilitado/"em breve"
   nesta fase (fora de escopo do MVP).

## API (Backend) — todas as rotas são somente leitura (`SELECT`)

- `GET /api/schemas` — lista schemas do DB2 com contagem de tabelas
  (`SYSCAT.TABLES` agrupado por `TABSCHEMA`) + camada inferida — usada pelo
  Scanner e pela busca do Catálogo.
- `GET /api/catalog/schemas?filter=schema1,schema2` — schemas para exibir
  no catálogo (todos, ou filtrados pela seleção vinda do Scanner).
- `GET /api/catalog/schemas/:schema/tables` — tabelas/views daquele schema
  (`SYSCAT.TABLES`), com `REMARKS` e classificação inferida.
- `GET /api/catalog/schemas/:schema/tables/:table` — detalhe: colunas
  (`SYSCAT.COLUMNS`), indicador de chave primária
  (`SYSCAT.TABCONST`/`KEYCOLUSE`), descrição e classificação.
- `GET /api/dashboard/summary` — contadores agregados para a home (total de
  schemas, total de tabelas, distribuição por camada inferida).

## Riscos e premissas

- **`ibm_db` no Node.js**: **já validado nesta máquina** — instala via
  `npm install ibm_db` (o script de pós-instalação que baixaria o driver é
  bloqueado por política de `allow-scripts`, mas o pacote usa o
  `clidriver` já instalado em `C:/IBM/Drivers/clidriver`, e uma conexão de
  teste real contra o DB2 dev funcionou). Não há mais risco/contingência
  aqui.
- **Privilégios do usuário `devlucas`**: confirmado por teste direto que
  ele **não tem `CREATE SCHEMA`** nem escrita em schemas de terceiros
  (`SQL0552N`/`SQL0551N`). Por isso o portal é 100% leitura — nenhuma rota
  do backend executa `CREATE`/`INSERT`/`UPDATE`/`DROP`. Isso também elimina
  o risco de o portal acidentalmente alterar dados de outros times.
- **Volume**: alguns schemas legados têm 100-300 tabelas, mas como só
  consultamos as tabelas de sistema do DB2 (`SYSCAT.*`, não os dados em si),
  mesmo "Todos os schemas" é uma consulta rápida (uma única query com
  `WHERE TABSCHEMA IN (...)`), sem necessidade de barra de progresso.
- **Comentários com encoding**: os `REMARKS` no DB2 têm acentuação e, em
  alguns casos, caracteres corrompidos (mojibake, ex: "Cat?logo"). O parser
  de classificação deve ser tolerante a isso (regex sem depender de acentos).

## Fora de escopo (fica para depois, não implementar agora)

- Autenticação/SSO com Active Directory.
- Qualquer persistência própria de catálogo (CRUD de governança,
  classificação manual, linhagem) — depende de um schema com permissão de
  escrita, que não existe hoje para `devlucas`.
- Apontar para PostgreSQL ou DB2 produção (arquitetura já prevê isso via
  camada de repositório, mas a troca em si não faz parte deste MVP).

## Testes

- Backend: testes unitários das funções puras de inferência
  (`inferCamada`/`inferDominio`/`inferClassificacao`, sem banco) +
  testes de integração dos repositórios contra o DB2 dev real (ambiente já
  é de desenvolvimento, consultas somente leitura, sem risco de alterar
  dado).
- Frontend: verificação manual no navegador (rodar `npm run dev`, navegar
  pelas 3 telas principais) — sem suíte automatizada de UI nesta fase de
  homologação.
