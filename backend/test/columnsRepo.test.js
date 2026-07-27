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
