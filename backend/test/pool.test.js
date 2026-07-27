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
