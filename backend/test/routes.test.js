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

test('GET /api/catalog/schemas retorna lista de schemas sem filtro', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/catalog/schemas`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.some((s) => s.schema === 'CUR_COM'));
    assert.ok(body.length > 1);
  } finally {
    server.close();
  }
});

test('GET /api/catalog/schemas?filter=CUR_COM retorna somente o schema filtrado', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/catalog/schemas?filter=CUR_COM`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    assert.ok(body.every((s) => s.schema === 'CUR_COM'));
  } finally {
    server.close();
  }
});

test('GET /api/catalog/schemas/:schema/tables/:table retorna 500 quando o repositório rejeita (erro real do DB2)', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    // Um valor de schema absurdamente longo faz o DB2 rejeitar o bind param
    // com "String data right truncation" (SQLSTATE 22001) - um erro real,
    // não mockado, que exercita o middleware de erro (500 + { error }).
    const longSchema = 'A'.repeat(500);
    const res = await fetch(`http://localhost:${port}/api/catalog/schemas/${longSchema}/tables/X`);
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.ok(typeof body.error === 'string' && body.error.length > 0);
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

test('GET /api/catalog/schemas/:schema/tables/:table/saude retorna resumo leve de saude', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/catalog/schemas/CUR_REF/tables/PAIS/saude`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { totalRegistros: 252, saude: { percentual: 100, classificacao: 'Excelente' } });
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
    assert.equal(body.totalRegistros, 252);
    const idPais = body.columns.find((c) => c.name === 'ID_PAIS');
    assert.deepEqual(idPais.completude, { percentual: 100, classificacao: 'Excelente' });
    assert.deepEqual(body.saude, { percentual: 100, classificacao: 'Excelente' });
    const dtAtuDados = body.columns.find((c) => c.name === 'DT_ATU_DADOS');
    assert.equal(dtAtuDados.completude, null, 'coluna de auditoria não deve ter completude calculada');
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
    assert.ok(body.totalViews > 0);
    assert.ok(typeof body.porCamada === 'object');
  } finally {
    server.close();
  }
});

test('GET /api/dashboard/saude retorna a saude agregada dos schemas governados', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/dashboard/saude`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.totalTabelasAvaliadas > 0);
    assert.ok(body.percentual >= 0 && body.percentual <= 100);
    assert.ok(['Excelente', 'Bom', 'Atenção'].includes(body.classificacao));
  } finally {
    server.close();
  }
});

test('GET /api/catalog/columns/search retorna colunas cujo nome bate com o termo', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/catalog/columns/search?q=CNPJ`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.some((r) => r.schema === 'CUR_COM' && r.table === 'IMPORTADOR' && r.column === 'NR_CNPJ'));
  } finally {
    server.close();
  }
});

test('GET /api/catalog/columns/search sem termo retorna lista vazia', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/catalog/columns/search`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  } finally {
    server.close();
  }
});

test('GET /api/domains retorna os 24 dominios de negocio com uso real', async () => {
  const app = createApp();
  const server = await listen(app);
  const { port } = server.address();
  try {
    const res = await fetch(`http://localhost:${port}/api/domains`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.length, 24);
    assert.ok(body.some((d) => d.code === 'COM' && d.name === 'Comercial' && d.schemaCount >= 2));
  } finally {
    server.close();
  }
});
