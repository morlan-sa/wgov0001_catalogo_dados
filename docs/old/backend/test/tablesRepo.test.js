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

test('listTables decodifica acentos da REMARKS corretamente (sem caracteres de substituicao)', async () => {
  const tables = await listTables('CUR_MKT');
  const mercado = tables.find((t) => t.name === 'MERCADO_IMPORTACAO');
  assert.ok(mercado, 'deveria encontrar a tabela MERCADO_IMPORTACAO');
  assert.ok(
    mercado.description.includes('Importação') && mercado.description.includes('inteligência'),
    `descrição deveria ter acentos corretos, veio: ${mercado.description}`
  );
  assert.ok(!mercado.description.includes('�'), 'não deveria conter caracteres de substituição U+FFFD');
});
