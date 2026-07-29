# Portal de Governança e Catálogo de Dados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only React + Node.js portal that lets a user browse the DB2 dev database's schemas/tables/columns as a data catalog, with a 2-step "Scanner" wizard to pick which schemas to explore.

**Architecture:** React (Vite, plain JavaScript) frontend talks to an Express REST API (Node.js, plain JavaScript) which is the only thing that talks to DB2 (via `ibm_db`). Every DB2 query is a `SELECT` against `SYSCAT.*` system catalog views — the portal never creates, writes, or modifies anything in the database. Metadata (schema "camada"/domain/classification) is inferred in memory on every request from schema-name conventions and existing `REMARKS` text; nothing is persisted by the portal itself.

**Tech Stack:** Node.js (>=20, ESM `"type": "module"`), Express 4, `ibm_db` 4.x, React 18, React Router 6, Vite 6, Tailwind CSS 4, `lucide-react`. Node's built-in `node:test` for backend tests (no extra test framework dependency).

## Global Constraints

- DB2 access is **read-only** — no route, repository, or script may execute `CREATE`/`INSERT`/`UPDATE`/`DELETE`/`DROP` against DB2. Confirmed hard constraint: user `devlucas` lacks `CREATE SCHEMA` and lacks write access to other schemas (`SQL0552N`/`SQL0551N` when tested).
- DB2 credentials come **only** from `C:/Morlan_Python/Explorar/.env` (`DB2_HOST`, `DB2_PORT`, `DB2_DATABASE`, `DB2_USER`, `DB2_PASS`). Never hardcode them, never copy them into the frontend, never commit a `.env` file inside `21_Portal_Governança/`.
- Frontend is plain JavaScript (`.jsx`), not TypeScript.
- No authentication/login in this phase.
- Both `backend/` and `frontend/` are separate npm packages with `"type": "module"`.
- No new dependency beyond what's listed in the Tech Stack without a concrete reason tied to a task below.

---

## File Structure

```
21_Portal_Governança/
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── config/env.js
│   │   ├── db/pool.js
│   │   ├── repositories/schemasRepo.js
│   │   ├── repositories/tablesRepo.js
│   │   ├── repositories/columnsRepo.js
│   │   ├── services/inference.js
│   │   ├── routes/schemas.js
│   │   ├── routes/catalog.js
│   │   ├── routes/dashboard.js
│   │   ├── app.js
│   │   └── server.js
│   └── test/
│       ├── inference.test.js
│       ├── schemasRepo.test.js
│       ├── tablesRepo.test.js
│       ├── columnsRepo.test.js
│       └── routes.test.js
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── api/client.js
│       ├── components/Sidebar.jsx
│       ├── components/Breadcrumb.jsx
│       ├── components/Badge.jsx
│       ├── components/StatCard.jsx
│       └── pages/DashboardPage.jsx
│       └── pages/ScannerPage.jsx
│       └── pages/CatalogSchemasPage.jsx
│       └── pages/CatalogTablesPage.jsx
│       └── pages/CatalogTableDetailPage.jsx
└── docs/superpowers/{specs,plans}/  (already exist)
```

---

### Task 1: Repo init + backend scaffold + DB2 connection

**Files:**
- Create: `21_Portal_Governança/.gitignore`
- Create: `21_Portal_Governança/backend/package.json`
- Create: `21_Portal_Governança/backend/src/config/env.js`
- Create: `21_Portal_Governança/backend/src/db/pool.js`
- Test: `21_Portal_Governança/backend/test/pool.test.js`

**Interfaces:**
- Produces: `db2Config` (object: `{ database, hostname, port, uid, pwd }`) and `serverConfig` (object: `{ port }`) exported from `config/env.js`.
- Produces: `query(sql, params = [])` async function exported from `db/pool.js` — runs one `SELECT`, returns an array of row objects, opens+closes its own connection per call.

- [ ] **Step 1: Init git repo and add `.gitignore`**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git init
```

Write `21_Portal_Governança/.gitignore`:

```gitignore
node_modules/
dist/
.env
*.log
```

- [ ] **Step 2: Create backend package.json**

Write `21_Portal_Governança/backend/package.json`:

```json
{
  "name": "portal-governanca-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --test test/"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "ibm_db": "^4.0.1"
  }
}
```

Run:

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend"
npm install
```

Expected: installs without fatal errors (a `npm warn allow-scripts` about `ibm_db`'s postinstall driver download is expected and harmless — this machine already has the DB2 driver at `C:/IBM/Drivers/clidriver`).

- [ ] **Step 3: Write `config/env.js`**

Write `21_Portal_Governança/backend/src/config/env.js`:

```js
import { config as loadDotenv } from 'dotenv';

const ENV_PATH = 'C:/Morlan_Python/Explorar/.env';
loadDotenv({ path: ENV_PATH });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name} (esperada em ${ENV_PATH})`);
  }
  return value;
}

export const db2Config = {
  database: required('DB2_DATABASE'),
  hostname: required('DB2_HOST'),
  port: required('DB2_PORT'),
  uid: required('DB2_USER'),
  pwd: required('DB2_PASS'),
};

export const serverConfig = {
  port: Number(process.env.PORT) || 4000,
};
```

- [ ] **Step 4: Write the failing test for `db/pool.js`**

Write `21_Portal_Governança/backend/test/pool.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/db/pool.js';

test('query executa um SELECT simples contra o DB2 dev', async () => {
  const rows = await query('SELECT 1 AS UM FROM SYSIBM.SYSDUMMY1');
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].UM), 1);
});

test('query aceita parametros posicionais', async () => {
  const rows = await query(
    "SELECT COUNT(*) AS QTD FROM SYSCAT.TABLES WHERE TABSCHEMA = ? AND TYPE = ?",
    ['CUR_COM', 'T']
  );
  assert.ok(Number(rows[0].QTD) >= 1);
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: FAIL — `Cannot find module '../src/db/pool.js'`

- [ ] **Step 6: Implement `db/pool.js`**

Write `21_Portal_Governança/backend/src/db/pool.js`:

```js
import ibmdb from 'ibm_db';
import { db2Config } from '../config/env.js';

function buildConnectionString() {
  return (
    `DATABASE=${db2Config.database};` +
    `HOSTNAME=${db2Config.hostname};` +
    `PORT=${db2Config.port};` +
    'PROTOCOL=TCPIP;' +
    `UID=${db2Config.uid};` +
    `PWD=${db2Config.pwd};`
  );
}

function openConnection() {
  return new Promise((resolve, reject) => {
    ibmdb.open(buildConnectionString(), (err, conn) => {
      if (err) return reject(err);
      resolve(conn);
    });
  });
}

function closeConnection(conn) {
  return new Promise((resolve) => {
    conn.close(() => resolve());
  });
}

export async function query(sql, params = []) {
  const conn = await openConnection();
  try {
    const rows = await new Promise((resolve, reject) => {
      conn.query(sql, params, (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });
    return rows;
  } finally {
    await closeConnection(conn);
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add .gitignore backend/package.json backend/package-lock.json backend/src/config/env.js backend/src/db/pool.js backend/test/pool.test.js
git commit -m "feat: backend scaffold with read-only DB2 connection helper"
```

---

### Task 2: Inference service (camada / domínio / classificação)

**Files:**
- Create: `21_Portal_Governança/backend/src/services/inference.js`
- Test: `21_Portal_Governança/backend/test/inference.test.js`

**Interfaces:**
- Produces: `inferCamada(schemaName: string): string` — returns `'STG'|'CUR'|'RPT'|'LEGADO'`.
- Produces: `inferDominio(schemaName: string): { code: string, name: string }`.
- Produces: `inferClassificacao(remarks: string|null): string` — returns one of `'Público'|'Corporativo'|'Restrito'|'Sigiloso'|'Não classificado'`.

- [ ] **Step 1: Write the failing tests**

Write `21_Portal_Governança/backend/test/inference.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferCamada, inferDominio, inferClassificacao } from '../src/services/inference.js';

test('inferCamada reconhece prefixos governados', () => {
  assert.equal(inferCamada('STG_ERP'), 'STG');
  assert.equal(inferCamada('CUR_COM'), 'CUR');
  assert.equal(inferCamada('RPT_FIS'), 'RPT');
});

test('inferCamada classifica schema fora do padrao como LEGADO', () => {
  assert.equal(inferCamada('RCHUMANO'), 'LEGADO');
  assert.equal(inferCamada('COMPRAS'), 'LEGADO');
});

test('inferDominio reconhece sufixo de dominio cadastrado', () => {
  assert.deepEqual(inferDominio('CUR_COM'), { code: 'COM', name: 'Comercial' });
  assert.deepEqual(inferDominio('RPT_FIS'), { code: 'FIS', name: 'Fiscal' });
});

test('inferDominio cai em Nao classificado quando sufixo nao bate', () => {
  assert.deepEqual(inferDominio('STG_ERP'), { code: 'NC', name: 'Não classificado' });
  assert.deepEqual(inferDominio('COMPRAS'), { code: 'NC', name: 'Não classificado' });
});

test('inferClassificacao le o padrao Classificacao: X no remarks', () => {
  assert.equal(inferClassificacao('Importador - dado sensivel. Classificacao: RESTRITO'), 'Restrito');
  assert.equal(inferClassificacao('NCM - referencia fiscal. Classificação: PUBLICO'), 'Público');
});

test('inferClassificacao tolera encoding corrompido nos acentos', () => {
  assert.equal(inferClassificacao('Classifica\uFFFD\uFFFDo: SIGILOSO'), 'Sigiloso');
});

test('inferClassificacao retorna Nao classificado quando remarks e nulo ou sem padrao', () => {
  assert.equal(inferClassificacao(null), 'Não classificado');
  assert.equal(inferClassificacao('Uma tabela qualquer sem marcacao'), 'Não classificado');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: FAIL — `Cannot find module '../src/services/inference.js'`

- [ ] **Step 3: Implement `services/inference.js`**

Write `21_Portal_Governança/backend/src/services/inference.js`:

```js
const DOMINIOS_NEGOCIO = {
  COM: 'Comercial',
  FAT: 'Faturamento',
  FIN: 'Financeiro',
  CST: 'Custos',
  CTB: 'Contábil',
  FIS: 'Fiscal',
  CPR: 'Compras',
  SUP: 'Suprimentos',
  EST: 'Estoque',
  PRD: 'Produção',
  QUA: 'Qualidade',
  ENG: 'Engenharia',
  MAN: 'Manutenção',
  LOG: 'Logística',
  TRN: 'Transporte',
  EXP: 'Expedição',
  RHU: 'Recursos Humanos',
  SST: 'Segurança do Trabalho',
  CTR: 'Controladoria',
  AUD: 'Auditoria',
  GOV: 'Governança de Dados',
  TIN: 'Tecnologia da Informação',
  MKT: 'Marketing',
  IAM: 'Identidade e Controle de Acesso',
};

const CAMADA_PREFIXOS = ['STG', 'CUR', 'RPT'];

export function inferCamada(schemaName) {
  const prefix = schemaName.split('_')[0];
  return CAMADA_PREFIXOS.includes(prefix) ? prefix : 'LEGADO';
}

export function inferDominio(schemaName) {
  const parts = schemaName.split('_');
  const suffix = parts.length > 1 ? parts.slice(1).join('_') : null;
  if (suffix && DOMINIOS_NEGOCIO[suffix]) {
    return { code: suffix, name: DOMINIOS_NEGOCIO[suffix] };
  }
  return { code: 'NC', name: 'Não classificado' };
}

const CLASSIFICACAO_REGEX = /CLASSIFICA[^:]*:?\s*(PUBLICO|CORPORATIVO|RESTRITO|SIGILOSO)/i;

const CLASSIFICACAO_LABELS = {
  PUBLICO: 'Público',
  CORPORATIVO: 'Corporativo',
  RESTRITO: 'Restrito',
  SIGILOSO: 'Sigiloso',
};

export function inferClassificacao(remarks) {
  if (!remarks) return 'Não classificado';
  const match = remarks.toUpperCase().match(CLASSIFICACAO_REGEX);
  if (!match) return 'Não classificado';
  return CLASSIFICACAO_LABELS[match[1]] ?? 'Não classificado';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: PASS (all inference tests + Task 1's pool tests)

- [ ] **Step 5: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add backend/src/services/inference.js backend/test/inference.test.js
git commit -m "feat: add pure inference functions for camada/dominio/classificacao"
```

---

### Task 3: schemasRepo

**Files:**
- Create: `21_Portal_Governança/backend/src/repositories/schemasRepo.js`
- Test: `21_Portal_Governança/backend/test/schemasRepo.test.js`

**Interfaces:**
- Consumes: `query` from `../db/pool.js` (Task 1); `inferCamada`, `inferDominio` from `../services/inference.js` (Task 2).
- Produces: `listSchemas(): Promise<Array<{ schema: string, tableCount: number, camada: string, dominio: { code: string, name: string } }>>`.

- [ ] **Step 1: Write the failing test**

Write `21_Portal_Governança/backend/test/schemasRepo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listSchemas } from '../src/repositories/schemasRepo.js';

test('listSchemas retorna schemas reais do DB2 dev com contagem de tabelas', async () => {
  const schemas = await listSchemas();
  assert.ok(Array.isArray(schemas));
  assert.ok(schemas.length > 10, 'deveria haver mais de 10 schemas no DB2 dev');

  const curCom = schemas.find((s) => s.schema === 'CUR_COM');
  assert.ok(curCom, 'CUR_COM deveria aparecer na lista de schemas');
  assert.equal(curCom.camada, 'CUR');
  assert.deepEqual(curCom.dominio, { code: 'COM', name: 'Comercial' });
  assert.ok(curCom.tableCount >= 1);

  const legado = schemas.find((s) => s.schema === 'COMPRAS');
  assert.ok(legado, 'COMPRAS deveria aparecer na lista de schemas');
  assert.equal(legado.camada, 'LEGADO');
  assert.deepEqual(legado.dominio, { code: 'NC', name: 'Não classificado' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: FAIL — `Cannot find module '../src/repositories/schemasRepo.js'`

- [ ] **Step 3: Implement `repositories/schemasRepo.js`**

Write `21_Portal_Governança/backend/src/repositories/schemasRepo.js`:

```js
import { query } from '../db/pool.js';
import { inferCamada, inferDominio } from '../services/inference.js';

export async function listSchemas() {
  const sql = `
    SELECT TABSCHEMA, COUNT(*) AS QTD_TABELAS
    FROM SYSCAT.TABLES
    WHERE TYPE IN ('T', 'V')
    GROUP BY TABSCHEMA
    ORDER BY TABSCHEMA
  `;
  const rows = await query(sql);
  return rows.map((row) => {
    const schema = row.TABSCHEMA.trim();
    return {
      schema,
      tableCount: Number(row.QTD_TABELAS),
      camada: inferCamada(schema),
      dominio: inferDominio(schema),
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add backend/src/repositories/schemasRepo.js backend/test/schemasRepo.test.js
git commit -m "feat: add schemasRepo listing DB2 schemas with inferred camada"
```

---

### Task 4: tablesRepo

**Files:**
- Create: `21_Portal_Governança/backend/src/repositories/tablesRepo.js`
- Test: `21_Portal_Governança/backend/test/tablesRepo.test.js`

**Interfaces:**
- Consumes: `query` from `../db/pool.js` (Task 1); `inferClassificacao` from `../services/inference.js` (Task 2).
- Produces: `listTables(schema: string): Promise<Array<{ name: string, type: 'Tabela'|'View', description: string|null, classification: string }>>`.

- [ ] **Step 1: Write the failing test**

Write `21_Portal_Governança/backend/test/tablesRepo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listTables } from '../src/repositories/tablesRepo.js';

test('listTables retorna a tabela IMPORTADOR em CUR_COM classificada como Restrito', async () => {
  const tables = await listTables('CUR_COM');
  assert.ok(tables.length >= 1);

  const importador = tables.find((t) => t.name === 'IMPORTADOR');
  assert.ok(importador, 'deveria encontrar a tabela IMPORTADOR');
  assert.equal(importador.type, 'Tabela');
  assert.equal(importador.classification, 'Restrito');
  assert.ok(importador.description && importador.description.length > 0);
});

test('listTables retorna lista vazia para schema sem tabelas de usuario', async () => {
  const tables = await listTables('SCHEMA_QUE_NAO_EXISTE_XYZ');
  assert.deepEqual(tables, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: FAIL — `Cannot find module '../src/repositories/tablesRepo.js'`

- [ ] **Step 3: Implement `repositories/tablesRepo.js`**

Write `21_Portal_Governança/backend/src/repositories/tablesRepo.js`:

```js
import { query } from '../db/pool.js';
import { inferClassificacao } from '../services/inference.js';

export async function listTables(schema) {
  const sql = `
    SELECT TABNAME, TYPE, REMARKS
    FROM SYSCAT.TABLES
    WHERE TABSCHEMA = ? AND TYPE IN ('T', 'V')
    ORDER BY TABNAME
  `;
  const rows = await query(sql, [schema]);
  return rows.map((row) => {
    const remarks = row.REMARKS ? row.REMARKS.trim() : null;
    return {
      name: row.TABNAME.trim(),
      type: row.TYPE.trim() === 'V' ? 'View' : 'Tabela',
      description: remarks,
      classification: inferClassificacao(remarks),
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add backend/src/repositories/tablesRepo.js backend/test/tablesRepo.test.js
git commit -m "feat: add tablesRepo listing tables/views per schema with inferred classification"
```

---

### Task 5: columnsRepo

**Files:**
- Create: `21_Portal_Governança/backend/src/repositories/columnsRepo.js`
- Test: `21_Portal_Governança/backend/test/columnsRepo.test.js`

**Interfaces:**
- Consumes: `query` from `../db/pool.js` (Task 1).
- Produces: `listColumns(schema: string, table: string): Promise<Array<{ name, type, length, scale, nullable, order, description, isPrimaryKey }>>`.

- [ ] **Step 1: Write the failing test**

Write `21_Portal_Governança/backend/test/columnsRepo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listColumns } from '../src/repositories/columnsRepo.js';

test('listColumns retorna colunas de CUR_REF.PAIS com ID_PAIS marcado como chave primaria', async () => {
  const columns = await listColumns('CUR_REF', 'PAIS');
  assert.ok(columns.length > 0);

  const idPais = columns.find((c) => c.name === 'ID_PAIS');
  assert.ok(idPais, 'deveria existir a coluna ID_PAIS');
  assert.equal(idPais.isPrimaryKey, true);

  const orders = columns.map((c) => c.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b), 'colunas devem vir ordenadas por COLNO');
});

test('listColumns retorna lista vazia para tabela inexistente', async () => {
  const columns = await listColumns('CUR_REF', 'TABELA_QUE_NAO_EXISTE_XYZ');
  assert.deepEqual(columns, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: FAIL — `Cannot find module '../src/repositories/columnsRepo.js'`

- [ ] **Step 3: Implement `repositories/columnsRepo.js`**

Write `21_Portal_Governança/backend/src/repositories/columnsRepo.js`:

```js
import { query } from '../db/pool.js';

const COLUMNS_SQL = `
  SELECT COLNAME, TYPENAME, LENGTH, SCALE, NULLS, COLNO, REMARKS
  FROM SYSCAT.COLUMNS
  WHERE TABSCHEMA = ? AND TABNAME = ?
  ORDER BY COLNO
`;

const PK_SQL = `
  SELECT K.COLNAME
  FROM SYSCAT.TABCONST T
  JOIN SYSCAT.KEYCOLUSE K
    ON T.CONSTNAME = K.CONSTNAME AND T.TABSCHEMA = K.TABSCHEMA AND T.TABNAME = K.TABNAME
  WHERE T.TABSCHEMA = ? AND T.TABNAME = ? AND T.TYPE = 'P'
`;

export async function listColumns(schema, table) {
  const [columnRows, pkRows] = await Promise.all([
    query(COLUMNS_SQL, [schema, table]),
    query(PK_SQL, [schema, table]),
  ]);
  const pkNames = new Set(pkRows.map((r) => r.COLNAME.trim()));

  return columnRows.map((row) => ({
    name: row.COLNAME.trim(),
    type: row.TYPENAME.trim(),
    length: row.LENGTH,
    scale: row.SCALE,
    nullable: row.NULLS.trim() === 'Y',
    order: row.COLNO,
    description: row.REMARKS ? row.REMARKS.trim() : null,
    isPrimaryKey: pkNames.has(row.COLNAME.trim()),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add backend/src/repositories/columnsRepo.js backend/test/columnsRepo.test.js
git commit -m "feat: add columnsRepo listing columns with primary key detection"
```

---

### Task 6: Routes + Express app + server

**Files:**
- Create: `21_Portal_Governança/backend/src/routes/schemas.js`
- Create: `21_Portal_Governança/backend/src/routes/catalog.js`
- Create: `21_Portal_Governança/backend/src/routes/dashboard.js`
- Create: `21_Portal_Governança/backend/src/app.js`
- Create: `21_Portal_Governança/backend/src/server.js`
- Test: `21_Portal_Governança/backend/test/routes.test.js`

**Interfaces:**
- Consumes: `listSchemas` (Task 3), `listTables` (Task 4), `listColumns` (Task 5), `serverConfig` (Task 1).
- Produces: `createApp(): express.Express` exported from `app.js` (used directly by `server.js` and by the test, so tests don't need a live network port beyond what `node:test` opens itself).

- [ ] **Step 1: Add `cors` usage check and write the failing route tests**

Write `21_Portal_Governança/backend/test/routes.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test('GET /api/schemas retorna lista de schemas com camada', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/schemas`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.some((s) => s.schema === 'CUR_COM'));
  } finally {
    server.close();
  }
});

test('GET /api/catalog/schemas/:schema/tables retorna tabelas do schema', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/catalog/schemas/CUR_COM/tables`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.some((t) => t.name === 'IMPORTADOR'));
  } finally {
    server.close();
  }
});

test('GET /api/catalog/schemas/:schema/tables/:table retorna detalhe com colunas', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/catalog/schemas/CUR_REF/tables/PAIS`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.schema, 'CUR_REF');
    assert.ok(body.columns.some((c) => c.name === 'ID_PAIS' && c.isPrimaryKey));
  } finally {
    server.close();
  }
});

test('GET /api/catalog/schemas/:schema/tables/:table retorna 404 para tabela inexistente', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/catalog/schemas/CUR_REF/tables/NAO_EXISTE_XYZ`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test('GET /api/dashboard/summary retorna contadores agregados', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/dashboard/summary`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.totalSchemas > 10);
    assert.ok(body.totalTables > 0);
    assert.ok(typeof body.porCamada === 'object');
  } finally {
    server.close();
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: FAIL — `Cannot find module '../src/app.js'`

- [ ] **Step 3: Add `cors` dependency**

Already declared in `package.json` from Task 1 (`"cors": "^2.8.5"`) — confirm it's installed:

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend"
npm ls cors
```

Expected: prints the installed `cors` version (no error).

- [ ] **Step 4: Implement the route files**

Write `21_Portal_Governança/backend/src/routes/schemas.js`:

```js
import { Router } from 'express';
import { listSchemas } from '../repositories/schemasRepo.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const schemas = await listSchemas();
    res.json(schemas);
  } catch (err) {
    next(err);
  }
});

export default router;
```

Write `21_Portal_Governança/backend/src/routes/catalog.js`:

```js
import { Router } from 'express';
import { listSchemas } from '../repositories/schemasRepo.js';
import { listTables } from '../repositories/tablesRepo.js';
import { listColumns } from '../repositories/columnsRepo.js';

const router = Router();

router.get('/schemas', async (req, res, next) => {
  try {
    const filterParam = req.query.filter;
    const filter = filterParam
      ? filterParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : null;
    const schemas = await listSchemas();
    const filtered = filter ? schemas.filter((s) => filter.includes(s.schema)) : schemas;
    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

router.get('/schemas/:schema/tables', async (req, res, next) => {
  try {
    const tables = await listTables(req.params.schema.toUpperCase());
    res.json(tables);
  } catch (err) {
    next(err);
  }
});

router.get('/schemas/:schema/tables/:table', async (req, res, next) => {
  try {
    const schema = req.params.schema.toUpperCase();
    const table = req.params.table.toUpperCase();
    const [tables, columns] = await Promise.all([
      listTables(schema),
      listColumns(schema, table),
    ]);
    const tableInfo = tables.find((t) => t.name === table);
    if (!tableInfo) {
      return res.status(404).json({ error: `Tabela ${schema}.${table} não encontrada` });
    }
    res.json({ ...tableInfo, schema, columns });
  } catch (err) {
    next(err);
  }
});

export default router;
```

Write `21_Portal_Governança/backend/src/routes/dashboard.js`:

```js
import { Router } from 'express';
import { listSchemas } from '../repositories/schemasRepo.js';

const router = Router();

router.get('/summary', async (req, res, next) => {
  try {
    const schemas = await listSchemas();
    const totalSchemas = schemas.length;
    const totalTables = schemas.reduce((sum, s) => sum + s.tableCount, 0);
    const porCamada = schemas.reduce((acc, s) => {
      acc[s.camada] = (acc[s.camada] || 0) + s.tableCount;
      return acc;
    }, {});
    res.json({ totalSchemas, totalTables, porCamada });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 5: Implement `app.js` and `server.js`**

Write `21_Portal_Governança/backend/src/app.js`:

```js
import express from 'express';
import cors from 'cors';
import schemasRouter from './routes/schemas.js';
import catalogRouter from './routes/catalog.js';
import dashboardRouter from './routes/dashboard.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/schemas', schemasRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/dashboard', dashboardRouter);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erro interno' });
  });

  return app;
}
```

Write `21_Portal_Governança/backend/src/server.js`:

```js
import { createApp } from './app.js';
import { serverConfig } from './config/env.js';

const app = createApp();
app.listen(serverConfig.port, () => {
  console.log(`Portal de Governança - backend rodando em http://localhost:${serverConfig.port}`);
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: PASS (all backend tests, ~15 across all files)

- [ ] **Step 7: Manually start the server and sanity-check one endpoint**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm start`
Expected console: `Portal de Governança - backend rodando em http://localhost:4000`

In a second terminal: `curl http://localhost:4000/api/dashboard/summary`
Expected: JSON body with `totalSchemas`, `totalTables`, `porCamada`. Stop the server (Ctrl+C) when confirmed.

- [ ] **Step 8: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add backend/src/routes backend/src/app.js backend/src/server.js backend/test/routes.test.js
git commit -m "feat: wire up Express routes for schemas/catalog/dashboard endpoints"
```

---

### Task 7: Frontend scaffold (Vite + React + Tailwind)

**Files:**
- Create: `21_Portal_Governança/frontend/package.json`
- Create: `21_Portal_Governança/frontend/index.html`
- Create: `21_Portal_Governança/frontend/vite.config.js`
- Create: `21_Portal_Governança/frontend/src/main.jsx`
- Create: `21_Portal_Governança/frontend/src/App.jsx`
- Create: `21_Portal_Governança/frontend/src/index.css`

**Interfaces:**
- Produces: a Vite dev server on port 5173 proxying `/api/*` to `http://localhost:4000` (Task 6's backend), so the frontend can call relative `/api/...` URLs in both dev and (later) prod.

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "portal-governanca-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^0.487.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.12",
    "@vitejs/plugin-react": "^4.3.1",
    "tailwindcss": "^4.1.12",
    "vite": "^6.3.5"
  }
}
```

Run:

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança/frontend"
npm install
```

Expected: installs without fatal errors.

- [ ] **Step 2: Write `vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 3: Write `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Portal de Governança de Dados</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Write `src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 5: Write `src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 6: Write a placeholder `src/App.jsx`** (replaced fully in Task 11, but needed now so the dev server has something to render)

```jsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Portal de Governança — carregando telas...
    </div>
  );
}
```

- [ ] **Step 7: Run the dev server and verify it boots**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/frontend" && npm run dev`
Expected console: `VITE vX.X.X ready in ... ms` and a `Local: http://localhost:5173/` URL. Open it in a browser and confirm the placeholder text renders with no console errors. Stop the server (Ctrl+C) when confirmed.

- [ ] **Step 8: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add frontend/package.json frontend/package-lock.json frontend/index.html frontend/vite.config.js frontend/src/main.jsx frontend/src/App.jsx frontend/src/index.css
git commit -m "feat: scaffold React + Vite + Tailwind frontend"
```

---

### Task 8: API client + shared components

**Files:**
- Create: `21_Portal_Governança/frontend/src/api/client.js`
- Create: `21_Portal_Governança/frontend/src/components/Sidebar.jsx`
- Create: `21_Portal_Governança/frontend/src/components/Breadcrumb.jsx`
- Create: `21_Portal_Governança/frontend/src/components/Badge.jsx`
- Create: `21_Portal_Governança/frontend/src/components/StatCard.jsx`

**Interfaces:**
- Produces from `api/client.js`: `getSchemas()`, `getCatalogSchemas(filterArray)`, `getCatalogTables(schema)`, `getCatalogTableDetail(schema, table)`, `getDashboardSummary()` — all return Promises resolving to parsed JSON, matching the shapes from Task 6's routes.
- Produces: `<Sidebar />`, `<Breadcrumb items={[{label, to?}]} />`, `<Badge>{text}</Badge>`, `<StatCard label value />` — consumed by pages in Tasks 9-11.

- [ ] **Step 1: Write `src/api/client.js`**

```js
const BASE_URL = '/api';

async function request(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${response.status} ao chamar ${path}`);
  }
  return response.json();
}

export function getSchemas() {
  return request('/schemas');
}

export function getCatalogSchemas(filter) {
  const query = filter && filter.length ? `?filter=${filter.join(',')}` : '';
  return request(`/catalog/schemas${query}`);
}

export function getCatalogTables(schema) {
  return request(`/catalog/schemas/${schema}/tables`);
}

export function getCatalogTableDetail(schema, table) {
  return request(`/catalog/schemas/${schema}/tables/${table}`);
}

export function getDashboardSummary() {
  return request('/dashboard/summary');
}
```

- [ ] **Step 2: Write `src/components/Sidebar.jsx`**

```jsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, ScanSearch, Boxes } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/catalogo', label: 'Catálogo', icon: BookOpen },
  { to: '/scanner', label: 'Scanner', icon: ScanSearch },
];

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-[#1A3A5C] text-white flex flex-col min-h-screen">
      <div className="px-4 py-5 text-lg font-bold tracking-wide border-b border-white/10">
        Portal Governança
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? 'bg-white/15 font-semibold' : 'text-white/85 hover:bg-white/10'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/40 cursor-not-allowed">
          <Boxes size={16} />
          Domínios
          <span className="text-[10px] ml-auto">em breve</span>
        </div>
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Write `src/components/Breadcrumb.jsx`**

```jsx
import { Link } from 'react-router-dom';

export default function Breadcrumb({ items }) {
  return (
    <nav className="text-sm text-slate-500 mb-4 flex items-center gap-1 flex-wrap">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {item.to && !isLast ? (
              <Link to={item.to} className="hover:text-[#1A3A5C] hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-[#1A3A5C] font-semibold' : ''}>{item.label}</span>
            )}
            {!isLast && <span className="text-slate-300">›</span>}
          </span>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Write `src/components/Badge.jsx`**

```jsx
const COLOR_BY_CLASSIFICATION = {
  Sigiloso: 'bg-red-100 text-red-700',
  Restrito: 'bg-amber-100 text-amber-700',
  Corporativo: 'bg-blue-100 text-blue-700',
  Público: 'bg-emerald-100 text-emerald-700',
  'Não classificado': 'bg-slate-100 text-slate-500',
};

export default function Badge({ children }) {
  const classes = COLOR_BY_CLASSIFICATION[children] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 5: Write `src/components/StatCard.jsx`**

```jsx
export default function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex-1 min-w-[140px]">
      <div className="text-2xl font-bold text-[#1A3A5C]">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add frontend/src/api frontend/src/components
git commit -m "feat: add API client and shared UI components"
```

---

### Task 9: Dashboard page

**Files:**
- Create: `21_Portal_Governança/frontend/src/pages/DashboardPage.jsx`

**Interfaces:**
- Consumes: `getDashboardSummary()` (Task 8), `<StatCard />` (Task 8).

- [ ] **Step 1: Write `src/pages/DashboardPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import StatCard from '../components/StatCard.jsx';
import { getDashboardSummary } from '../api/client.js';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboardSummary().then(setSummary).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-red-600">Erro ao carregar dashboard: {error}</p>;
  if (!summary) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">Dashboard</h1>
      <div className="flex gap-4 mb-6 flex-wrap">
        <StatCard label="Schemas no DB2" value={summary.totalSchemas} />
        <StatCard label="Tabelas/Views" value={summary.totalTables} />
      </div>
      <h2 className="text-sm font-semibold text-slate-600 mb-2">Tabelas por camada</h2>
      <div className="flex gap-4 flex-wrap">
        {Object.entries(summary.porCamada).map(([camada, count]) => (
          <StatCard key={camada} label={camada} value={count} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add frontend/src/pages/DashboardPage.jsx
git commit -m "feat: add Dashboard page"
```

---

### Task 10: Scanner page (2-step wizard)

**Files:**
- Create: `21_Portal_Governança/frontend/src/pages/ScannerPage.jsx`

**Interfaces:**
- Consumes: `getSchemas()` (Task 8).
- Produces: navigates to `/catalogo?filter=SCHEMA1,SCHEMA2` on completion (consumed by Task 11's `CatalogSchemasPage`).

- [ ] **Step 1: Write `src/pages/ScannerPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSchemas } from '../api/client.js';

const GOVERNADAS = ['STG', 'CUR', 'RPT'];

export default function ScannerPage() {
  const [schemas, setSchemas] = useState([]);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [filterText, setFilterText] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getSchemas().then(setSchemas).catch((err) => setError(err.message));
  }, []);

  function chooseShortcut(kind) {
    if (kind === 'governadas') {
      setSelected(new Set(schemas.filter((s) => GOVERNADAS.includes(s.camada)).map((s) => s.schema)));
    } else if (kind === 'todas') {
      setSelected(new Set(schemas.map((s) => s.schema)));
    } else {
      setSelected(new Set());
    }
    setStep(2);
  }

  function toggle(schema) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(schema)) {
        next.delete(schema);
      } else {
        next.add(schema);
      }
      return next;
    });
  }

  function runQuery() {
    navigate(`/catalogo?filter=${Array.from(selected).join(',')}`);
  }

  if (error) return <p className="text-red-600">Erro ao carregar schemas: {error}</p>;

  const visibleSchemas = schemas.filter((s) =>
    s.schema.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">Scanner</h1>

      {step === 1 && (
        <div className="space-y-3 max-w-md">
          <p className="text-sm text-slate-500 mb-2">Passo 1 de 2 — Escolha o grupo</p>
          <button
            onClick={() => chooseShortcut('governadas')}
            className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-[#2C6B9E]"
          >
            <div className="font-semibold text-[#1A3A5C]">Schemas governados</div>
            <div className="text-sm text-slate-500">STG_ / CUR_ / RPT_</div>
          </button>
          <button
            onClick={() => chooseShortcut('todas')}
            className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-[#2C6B9E]"
          >
            <div className="font-semibold">Todos os schemas</div>
            <div className="text-sm text-slate-500">{schemas.length} schemas</div>
          </button>
          <button
            onClick={() => chooseShortcut('manual')}
            className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-[#2C6B9E]"
          >
            <div className="font-semibold">Escolher manualmente</div>
            <div className="text-sm text-slate-500">Selecionar schema a schema</div>
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-md">
          <p className="text-sm text-slate-500 mb-2">Passo 2 de 2 — Confirme a seleção</p>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtrar schema"
            className="w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm mb-2"
          />
          <div className="border border-slate-200 rounded-lg p-2 max-h-72 overflow-y-auto space-y-1">
            {visibleSchemas.map((s) => (
              <label key={s.schema} className="flex items-center gap-2 px-2 py-1 text-sm">
                <input type="checkbox" checked={selected.has(s.schema)} onChange={() => toggle(s.schema)} />
                <span className="font-medium">{s.schema}</span>
                <span className="text-slate-400 ml-auto">{s.tableCount} tabelas</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setStep(1)} className="px-3 py-1.5 text-sm text-slate-600">
              Voltar
            </button>
            <button
              onClick={runQuery}
              disabled={selected.size === 0}
              className="px-3 py-1.5 text-sm bg-[#1A3A5C] text-white rounded-md disabled:opacity-40"
            >
              Consultar ({selected.size} schemas)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add frontend/src/pages/ScannerPage.jsx
git commit -m "feat: add Scanner 2-step wizard page"
```

---

### Task 11: Catalog pages + App routing

**Files:**
- Create: `21_Portal_Governança/frontend/src/pages/CatalogSchemasPage.jsx`
- Create: `21_Portal_Governança/frontend/src/pages/CatalogTablesPage.jsx`
- Create: `21_Portal_Governança/frontend/src/pages/CatalogTableDetailPage.jsx`
- Modify: `21_Portal_Governança/frontend/src/App.jsx` (replace the Task 7 placeholder)

**Interfaces:**
- Consumes: `getCatalogSchemas`, `getCatalogTables`, `getCatalogTableDetail` (Task 8); `<Breadcrumb />`, `<Badge />` (Task 8); `<Sidebar />` (Task 8); `<DashboardPage />` (Task 9); `<ScannerPage />` (Task 10).

- [ ] **Step 1: Write `src/pages/CatalogSchemasPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb.jsx';
import { getCatalogSchemas } from '../api/client.js';

export default function CatalogSchemasPage() {
  const [searchParams] = useSearchParams();
  const [schemas, setSchemas] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  const filterParam = searchParams.get('filter');

  useEffect(() => {
    const filter = filterParam ? filterParam.split(',').filter(Boolean) : null;
    getCatalogSchemas(filter).then(setSchemas).catch((err) => setError(err.message));
  }, [filterParam]);

  if (error) return <p className="text-red-600">Erro ao carregar catálogo: {error}</p>;

  const visible = schemas.filter((s) => s.schema.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Breadcrumb items={[{ label: 'Catálogo' }]} />
      <h1 className="text-xl font-bold text-slate-800 mb-4">Catálogo de Dados</h1>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar schema..."
        className="w-full max-w-sm border border-slate-200 rounded-md px-3 py-1.5 text-sm mb-4"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((s) => (
          <Link
            key={s.schema}
            to={`/catalogo/${s.schema}`}
            className="border border-slate-200 rounded-lg p-3 hover:border-[#2C6B9E] hover:shadow-sm"
          >
            <div className="font-semibold text-[#1A3A5C]">{s.schema}</div>
            <div className="text-sm text-slate-500">
              {s.tableCount} tabelas · {s.camada} · {s.dominio.name}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/pages/CatalogTablesPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb.jsx';
import Badge from '../components/Badge.jsx';
import { getCatalogTables } from '../api/client.js';

export default function CatalogTablesPage() {
  const { schema } = useParams();
  const [tables, setTables] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCatalogTables(schema).then(setTables).catch((err) => setError(err.message));
  }, [schema]);

  if (error) return <p className="text-red-600">Erro ao carregar tabelas: {error}</p>;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Catálogo', to: '/catalogo' }, { label: schema }]} />
      <h1 className="text-xl font-bold text-slate-800 mb-4">{schema}</h1>
      <div className="space-y-2">
        {tables.map((t) => (
          <Link
            key={t.name}
            to={`/catalogo/${schema}/${t.name}`}
            className="flex items-center justify-between border border-slate-200 rounded-lg p-3 hover:border-[#2C6B9E]"
          >
            <div>
              <div className="font-medium text-slate-800">{t.name}</div>
              <div className="text-sm text-slate-500">{t.description || 'Sem descrição cadastrada'}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{t.type}</span>
              <Badge>{t.classification}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/pages/CatalogTableDetailPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb.jsx';
import Badge from '../components/Badge.jsx';
import { getCatalogTableDetail } from '../api/client.js';

export default function CatalogTableDetailPage() {
  const { schema, table } = useParams();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCatalogTableDetail(schema, table).then(setDetail).catch((err) => setError(err.message));
  }, [schema, table]);

  if (error) return <p className="text-red-600">Erro ao carregar tabela: {error}</p>;
  if (!detail) return <p className="text-slate-500">Carregando...</p>;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Catálogo', to: '/catalogo' },
          { label: schema, to: `/catalogo/${schema}` },
          { label: table },
        ]}
      />
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold text-slate-800">
          {schema}.{table}
        </h1>
        <Badge>{detail.classification}</Badge>
      </div>
      <p className="text-sm text-slate-500 mb-4">{detail.description || 'Sem descrição cadastrada'}</p>
      <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>
            <th className="px-3 py-2">Coluna</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Nulo</th>
            <th className="px-3 py-2">PK</th>
            <th className="px-3 py-2">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {detail.columns.map((c) => (
            <tr key={c.name} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">{c.name}</td>
              <td className="px-3 py-2 text-slate-500">
                {c.type}
                {c.length ? `(${c.length}${c.scale ? `,${c.scale}` : ''})` : ''}
              </td>
              <td className="px-3 py-2">{c.nullable ? 'Sim' : 'Não'}</td>
              <td className="px-3 py-2">{c.isPrimaryKey ? '🔑' : ''}</td>
              <td className="px-3 py-2 text-slate-500">{c.description || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Replace `src/App.jsx`**

```jsx
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ScannerPage from './pages/ScannerPage.jsx';
import CatalogSchemasPage from './pages/CatalogSchemasPage.jsx';
import CatalogTablesPage from './pages/CatalogTablesPage.jsx';
import CatalogTableDetailPage from './pages/CatalogTableDetailPage.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route path="/catalogo" element={<CatalogSchemasPage />} />
          <Route path="/catalogo/:schema" element={<CatalogTablesPage />} />
          <Route path="/catalogo/:schema/:table" element={<CatalogTableDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add frontend/src/pages/CatalogSchemasPage.jsx frontend/src/pages/CatalogTablesPage.jsx frontend/src/pages/CatalogTableDetailPage.jsx frontend/src/App.jsx
git commit -m "feat: add catalog browsing pages and wire up app routing"
```

---

### Task 12: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the backend**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend"
npm start
```

Expected: `Portal de Governança - backend rodando em http://localhost:4000`

- [ ] **Step 2: Start the frontend (separate terminal)**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança/frontend"
npm run dev
```

Expected: Vite prints `Local: http://localhost:5173/`

- [ ] **Step 3: Browse the app and verify the golden path**

Open `http://localhost:5173/` in a browser and confirm, with no console errors:
1. **Dashboard** shows non-zero `Schemas no DB2` and `Tabelas/Views` counts, and a breakdown by camada (`STG`, `CUR`, `RPT`, `LEGADO`).
2. **Scanner** → click "Schemas governados" → step 2 shows only `STG_*`/`CUR_*`/`RPT_*` schemas pre-checked → click "Consultar" → lands on `/catalogo` showing only those schemas.
3. **Catálogo** (unfiltered, via sidebar) → shows all ~57 schemas, search box filters by typing `CUR` → click `CUR_COM` → shows `IMPORTADOR` with a **Restrito** badge → click into it → column table renders, `ID_IMPORTADOR` (or equivalent PK column) marked with 🔑.
4. Navigate `Catálogo → CUR_REF → PAIS` and confirm `ID_PAIS` is marked as PK.

- [ ] **Step 4: Fix any issues found during manual verification, re-test, then commit**

If any visual or data issue is found, fix the specific file, re-run the affected step above, and commit the fix with a message describing what was wrong (e.g. `fix: correct primary key lookup in columnsRepo`).

- [ ] **Step 5: Stop both dev servers** (Ctrl+C in each terminal).
