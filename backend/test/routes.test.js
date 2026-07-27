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
