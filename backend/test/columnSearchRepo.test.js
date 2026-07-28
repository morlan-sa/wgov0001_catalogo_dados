import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchColumns } from '../src/repositories/columnSearchRepo.js';

test('searchColumns encontra colunas por nome parcial em varios schemas', async () => {
  const results = await searchColumns('CNPJ', null);
  assert.ok(results.length > 0);
  assert.ok(results.every((r) => r.column.toUpperCase().includes('CNPJ')));
  assert.ok(results.every((r) => !r.schema.startsWith('SYS')));

  const importadorCnpj = results.find((r) => r.schema === 'CUR_COM' && r.table === 'IMPORTADOR');
  assert.ok(importadorCnpj, 'deveria encontrar NR_CNPJ em CUR_COM.IMPORTADOR');
  assert.equal(importadorCnpj.column, 'NR_CNPJ');
});

test('searchColumns respeita o filtro de schemas quando informado', async () => {
  const results = await searchColumns('ID_', ['CUR_REF']);
  assert.ok(results.length > 0);
  assert.ok(results.every((r) => r.schema === 'CUR_REF'));
});

test('searchColumns retorna lista vazia para termo vazio', async () => {
  assert.deepEqual(await searchColumns('', null), []);
  assert.deepEqual(await searchColumns('   ', null), []);
});

test('searchColumns retorna lista vazia quando nada bate com o termo', async () => {
  const results = await searchColumns('TERMO_QUE_NAO_EXISTE_XYZ_123', null);
  assert.deepEqual(results, []);
});
