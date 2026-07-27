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
