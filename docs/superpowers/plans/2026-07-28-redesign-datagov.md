# Redesign Visual DataGov Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing portal (Dashboard, Scanner, 3 Catálogo pages) to match the visual language of the "DataGov" Lovable reference (white sidebar with blue accent, icon-bearing stat cards, title+subtitle page headers), and add a new "semantic domain" badge per column (Identificador/Nome/Data/Código/etc., inferred from the column-name prefix taxonomy already documented in the org's governance skill).

**Architecture:** Same 3-level Catálogo drill-down as before (Schemas → Tables → Table detail) — no routing/API restructuring. This is a visual-only pass over existing components plus one new pure inference function threaded through the existing `columnsRepo` → `CatalogTableDetailPage` path.

**Tech Stack:** Same as the existing project — Node/Express backend, React/Vite/Tailwind 4 frontend, plain JavaScript. No new dependencies.

## Global Constraints

- Frontend stays plain JavaScript (`.jsx`), no TypeScript.
- No new npm dependency in either `backend/` or `frontend/`.
- Primary accent color across the app: Tailwind `blue-600` (`#2563eb`) as the primary/active color, `blue-700` (`#1d4ed8`) for hover/emphasis — replacing every hardcoded `#1A3A5C` / `#2C6B9E` value from the original build.
- Do not invent data the backend doesn't provide (e.g., no fake trend deltas like "+3 this month" on stat cards — the DataGov reference has those, but we have no historical tracking, so stat cards show only icon + value + label).
- Every backend query stays read-only (`SELECT` only) — this phase doesn't touch `pool.js`'s guard or the query shape's write-safety.

---

## File Structure

```
backend/
  src/services/inference.js         (MODIFY: add inferPrefixDomain)
  src/repositories/columnsRepo.js   (MODIFY: wire in inferPrefixDomain)
  test/inference.test.js            (MODIFY: add inferPrefixDomain tests)
  test/columnsRepo.test.js          (MODIFY: assert new `domain` field)
frontend/
  src/components/Sidebar.jsx        (MODIFY: white/blue redesign)
  src/components/StatCard.jsx       (MODIFY: add optional icon prop)
  src/components/Breadcrumb.jsx     (MODIFY: color tokens)
  src/pages/DashboardPage.jsx       (MODIFY: header pattern + icons)
  src/pages/ScannerPage.jsx         (MODIFY: color tokens)
  src/pages/CatalogSchemasPage.jsx  (MODIFY: color tokens + header pattern)
  src/pages/CatalogTablesPage.jsx   (MODIFY: color tokens)
  src/pages/CatalogTableDetailPage.jsx (MODIFY: color tokens + new "Domínio" column)
```

---

### Task 13: `inferPrefixDomain` — semantic domain inference

**Files:**
- Modify: `backend/src/services/inference.js`
- Modify: `backend/test/inference.test.js`

**Interfaces:**
- Consumes: nothing new (pure function, same file as existing `inferCamada`/`inferDominio`/`inferClassificacao`).
- Produces: `inferPrefixDomain(columnName: string): string` — returns one of `Código|Identificador|Nome|Descrição|Data|Hora|Número|Valor|Valor Monetário|Quantidade|Indicador|Tipo|Situação|Percentual|Telefone|Email|CEP|UF|Não classificado`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/test/inference.test.js` (append after the existing `inferClassificacao` tests, keep the existing tests untouched):

```js
import { inferPrefixDomain } from '../src/services/inference.js';

test('inferPrefixDomain reconhece prefixos de coluna cadastrados', () => {
  assert.equal(inferPrefixDomain('ID_IMPORTADOR'), 'Identificador');
  assert.equal(inferPrefixDomain('NR_CNPJ'), 'Número');
  assert.equal(inferPrefixDomain('NM_IMPORTADOR'), 'Nome');
  assert.equal(inferPrefixDomain('DT_GRAV_DADOS'), 'Data');
  assert.equal(inferPrefixDomain('IN_ATIVO'), 'Indicador');
  assert.equal(inferPrefixDomain('DS_HASH_LINHA'), 'Descrição');
  assert.equal(inferPrefixDomain('CD_PAIS'), 'Código');
  assert.equal(inferPrefixDomain('VR_TOTAL'), 'Valor Monetário');
});

test('inferPrefixDomain retorna Nao classificado para prefixo desconhecido', () => {
  assert.equal(inferPrefixDomain('FOOBAR_XYZ'), 'Não classificado');
  assert.equal(inferPrefixDomain('SEMPREFIXO'), 'Não classificado');
});
```

Note: this import line goes at the top of the test file alongside the existing `import { inferCamada, inferDominio, inferClassificacao } from '../src/services/inference.js';` — merge into one import statement rather than adding a second one:

```js
import { inferCamada, inferDominio, inferClassificacao, inferPrefixDomain } from '../src/services/inference.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: FAIL — `inferPrefixDomain is not a function` (or `is not exported`)

- [ ] **Step 3: Implement `inferPrefixDomain` in `inference.js`**

Add to `backend/src/services/inference.js` (after the existing `inferClassificacao` function, at the end of the file):

```js
const PREFIXO_DOMINIOS = {
  CD: 'Código',
  ID: 'Identificador',
  NM: 'Nome',
  DS: 'Descrição',
  DT: 'Data',
  HR: 'Hora',
  NR: 'Número',
  VL: 'Valor',
  VR: 'Valor Monetário',
  QT: 'Quantidade',
  IN: 'Indicador',
  TP: 'Tipo',
  ST: 'Situação',
  PC: 'Percentual',
  TEL: 'Telefone',
  EML: 'Email',
  CEP: 'CEP',
  UF: 'UF',
};

export function inferPrefixDomain(columnName) {
  const prefix = columnName.split('_')[0];
  return PREFIXO_DOMINIOS[prefix] || 'Não classificado';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add backend/src/services/inference.js backend/test/inference.test.js
git commit -m "feat: add inferPrefixDomain semantic column-domain inference"
```

---

### Task 14: Wire `inferPrefixDomain` into `columnsRepo`

**Files:**
- Modify: `backend/src/repositories/columnsRepo.js`
- Modify: `backend/test/columnsRepo.test.js`

**Interfaces:**
- Consumes: `inferPrefixDomain` from `../services/inference.js` (Task 13).
- Produces: `listColumns(schema, table)` now returns each column with an added `domain: string` field (alongside the existing `name, type, length, scale, nullable, order, description, isPrimaryKey`).

- [ ] **Step 1: Write the failing test**

Add to `backend/test/columnsRepo.test.js`, inside the existing `'listColumns retorna colunas de CUR_REF.PAIS...'` test (after the existing `idPais` assertions, before the `orders` check) — add:

```js
  assert.equal(idPais.domain, 'Identificador');

  const cdPais = columns.find((c) => c.name === 'CD_PAIS');
  assert.ok(cdPais, 'deveria existir a coluna CD_PAIS');
  assert.equal(cdPais.domain, 'Código');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: FAIL — `idPais.domain` is `undefined`

- [ ] **Step 3: Update `columnsRepo.js`**

Modify `backend/src/repositories/columnsRepo.js`:

```js
import { query } from '../db/pool.js';
import { inferPrefixDomain } from '../services/inference.js';

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

  return columnRows.map((row) => {
    const name = row.COLNAME.trim();
    return {
      name,
      type: row.TYPENAME.trim(),
      length: row.LENGTH,
      scale: row.SCALE,
      nullable: row.NULLS.trim() === 'Y',
      order: row.COLNO,
      description: row.REMARKS ? row.REMARKS.trim() : null,
      isPrimaryKey: pkNames.has(name),
      domain: inferPrefixDomain(name),
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Morlan_Python/Explorar/21_Portal_Governança/backend" && npm test`
Expected: PASS (full suite)

- [ ] **Step 5: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add backend/src/repositories/columnsRepo.js backend/test/columnsRepo.test.js
git commit -m "feat: expose inferred semantic domain per column in columnsRepo"
```

---

### Task 15: Restyle shared components (Sidebar, StatCard, Breadcrumb)

**Files:**
- Modify: `frontend/src/components/Sidebar.jsx`
- Modify: `frontend/src/components/StatCard.jsx`
- Modify: `frontend/src/components/Breadcrumb.jsx`

**Interfaces:**
- `StatCard` gains an optional `icon` prop (a `lucide-react` component, e.g. `Database`) rendered in a small blue badge box; existing callers that don't pass `icon` keep working (Task 16 updates `DashboardPage.jsx` to pass icons — until then the app still renders fine without them).
- `Sidebar`/`Breadcrumb` keep their existing props/usage (no interface change, only internal Tailwind classes and JSX for the nav header).

- [ ] **Step 1: Replace `Sidebar.jsx`**

```jsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, ScanSearch, Boxes, Database } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', description: 'Visão geral da governança', icon: LayoutDashboard, end: true },
  { to: '/catalogo', label: 'Catálogo', description: 'Schemas e tabelas do DB2', icon: BookOpen },
  { to: '/scanner', label: 'Scanner', description: 'Selecionar schemas para explorar', icon: ScanSearch },
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col min-h-screen">
      <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-200">
        <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-white shrink-0">
          <Database size={18} />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800 leading-tight">Portal Governança</div>
          <div className="text-xs text-slate-500 leading-tight">Governança de Dados</div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, description, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-start gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className="mt-0.5 shrink-0" />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className={`block text-xs ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                    {description}
                  </span>
                </span>
              </>
            )}
          </NavLink>
        ))}
        <div className="flex items-start gap-2 px-3 py-2 rounded-md text-sm text-slate-300 cursor-not-allowed">
          <Boxes size={16} className="mt-0.5 shrink-0" />
          <span>
            <span className="block font-medium">Domínios</span>
            <span className="block text-xs">em breve</span>
          </span>
        </div>
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Replace `StatCard.jsx`**

```jsx
export default function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex-1 min-w-[140px] shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-500">{label}</div>
        {Icon && (
          <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `Breadcrumb.jsx`**

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
              <Link to={item.to} className="hover:text-blue-700 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-blue-700 font-semibold' : ''}>{item.label}</span>
            )}
            {!isLast && <span className="text-slate-300">›</span>}
          </span>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Visually sanity-check in the browser**

With both dev servers running (`backend`: `npm start`, `frontend`: `npm run dev`), open `http://localhost:5173/` and confirm: sidebar is now white with a blue icon square and blue active nav item, no leftover `#1A3A5C`/`#2C6B9E` colors visible. (There's no automated frontend test suite in this project — this is a manual check, same as prior frontend tasks.)

- [ ] **Step 5: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add frontend/src/components/Sidebar.jsx frontend/src/components/StatCard.jsx frontend/src/components/Breadcrumb.jsx
git commit -m "style: redesign sidebar, stat card, and breadcrumb to DataGov visual language"
```

---

### Task 16: Restyle pages + wire icons + add "Domínio" column

**Files:**
- Modify: `frontend/src/pages/DashboardPage.jsx`
- Modify: `frontend/src/pages/ScannerPage.jsx`
- Modify: `frontend/src/pages/CatalogSchemasPage.jsx`
- Modify: `frontend/src/pages/CatalogTablesPage.jsx`
- Modify: `frontend/src/pages/CatalogTableDetailPage.jsx`

**Interfaces:**
- Consumes: `StatCard`'s new `icon` prop (Task 15); `domain` field now present on every column object returned by `getCatalogTableDetail` (Task 14, already flowing through the existing `/api/catalog/schemas/:schema/tables/:table` route unchanged).

- [ ] **Step 1: Replace `DashboardPage.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Database, Table2, Layers } from 'lucide-react';
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
      <h1 className="text-2xl font-bold text-slate-800">Dashboard de Governança</h1>
      <p className="text-sm text-slate-500 mb-6">Visão geral do catálogo de dados do DB2</p>
      <div className="flex gap-4 mb-6 flex-wrap">
        <StatCard label="Schemas no DB2" value={summary.totalSchemas} icon={Database} />
        <StatCard label="Tabelas/Views" value={summary.totalTables} icon={Table2} />
      </div>
      <h2 className="text-sm font-semibold text-slate-600 mb-2">Tabelas por camada</h2>
      <div className="flex gap-4 flex-wrap">
        {Object.entries(summary.porCamada).map(([camada, count]) => (
          <StatCard key={camada} label={camada} value={count} icon={Layers} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update color tokens in `ScannerPage.jsx`**

In `frontend/src/pages/ScannerPage.jsx`, replace every occurrence of `hover:border-[#2C6B9E]` with `hover:border-blue-400`, every `text-[#1A3A5C]` with `text-blue-700`, and `bg-[#1A3A5C]` with `bg-blue-600` (the "Consultar" button). The full updated file:

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
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Scanner</h1>
      <p className="text-sm text-slate-500 mb-6">Escolha quais schemas do DB2 explorar no catálogo</p>

      {step === 1 && (
        <div className="space-y-3 max-w-md">
          <p className="text-sm text-slate-500 mb-2">Passo 1 de 2 — Escolha o grupo</p>
          <button
            onClick={() => chooseShortcut('governadas')}
            className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-blue-400"
          >
            <div className="font-semibold text-blue-700">Schemas governados</div>
            <div className="text-sm text-slate-500">STG_ / CUR_ / RPT_</div>
          </button>
          <button
            onClick={() => chooseShortcut('todas')}
            className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-blue-400"
          >
            <div className="font-semibold">Todos os schemas</div>
            <div className="text-sm text-slate-500">{schemas.length} schemas</div>
          </button>
          <button
            onClick={() => chooseShortcut('manual')}
            className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-blue-400"
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
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md disabled:opacity-40"
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

- [ ] **Step 3: Update color tokens + header in `CatalogSchemasPage.jsx`**

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
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Catálogo de Dados</h1>
      <p className="text-sm text-slate-500 mb-4">Schemas e tabelas catalogados a partir do DB2</p>
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
            className="border border-slate-200 rounded-lg p-3 shadow-sm hover:border-blue-400 hover:shadow-md transition-shadow"
          >
            <div className="font-semibold text-blue-700">{s.schema}</div>
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

- [ ] **Step 4: Update color tokens in `CatalogTablesPage.jsx`**

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
      <h1 className="text-2xl font-bold text-slate-800 mb-4">{schema}</h1>
      <div className="space-y-2">
        {tables.map((t) => (
          <Link
            key={t.name}
            to={`/catalogo/${schema}/${t.name}`}
            className="flex items-center justify-between border border-slate-200 rounded-lg p-3 shadow-sm hover:border-blue-400 hover:shadow-md transition-shadow"
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

- [ ] **Step 5: Update `CatalogTableDetailPage.jsx`: color tokens + new "Domínio" column**

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
        <h1 className="text-2xl font-bold text-slate-800">
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
            <th className="px-3 py-2">Domínio</th>
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
              <td className="px-3 py-2">
                <Badge>{c.domain}</Badge>
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

- [ ] **Step 6: Visually verify in the browser**

With both dev servers running, browse: Dashboard (icons visible on stat cards, new subtitle), Scanner (blue accents, wizard still works end-to-end), Catálogo → a schema → a table (new "Domínio" column shows a badge per row, e.g. `ID_PAIS` → "Identificador", `CD_PAIS` → "Código"). Confirm no leftover `#1A3A5C`/`#2C6B9E` anywhere (search the frontend source if unsure: `grep -r "1A3A5C\|2C6B9E" frontend/src`).

- [ ] **Step 7: Commit**

```bash
cd "C:/Morlan_Python/Explorar/21_Portal_Governança"
git add frontend/src/pages/DashboardPage.jsx frontend/src/pages/ScannerPage.jsx frontend/src/pages/CatalogSchemasPage.jsx frontend/src/pages/CatalogTablesPage.jsx frontend/src/pages/CatalogTableDetailPage.jsx
git commit -m "style: apply DataGov visual language across all pages, add Domínio column"
```
