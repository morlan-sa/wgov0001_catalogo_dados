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

test('query rejeita DELETE sem abrir conexão', async () => {
  try {
    await query('DELETE FROM SYSCAT.TABLES WHERE 1=0');
    assert.fail('Expected query() to reject DELETE statement');
  } catch (err) {
    assert.match(
      err.message,
      /Somente consultas SELECT são permitidas/,
      'Error message should mention SELECT-only requirement'
    );
    assert.match(
      err.message,
      /DELETE/,
      'Error message should mention the attempted statement'
    );
  }
});

test('query rejeita INSERT sem abrir conexão', async () => {
  try {
    await query('INSERT INTO SYSCAT.TABLES VALUES (...)');
    assert.fail('Expected query() to reject INSERT statement');
  } catch (err) {
    assert.match(
      err.message,
      /Somente consultas SELECT são permitidas/,
      'Error message should mention SELECT-only requirement'
    );
  }
});

test('query rejeita UPDATE sem abrir conexão', async () => {
  try {
    await query('UPDATE SYSCAT.TABLES SET X = 1');
    assert.fail('Expected query() to reject UPDATE statement');
  } catch (err) {
    assert.match(
      err.message,
      /Somente consultas SELECT são permitidas/,
      'Error message should mention SELECT-only requirement'
    );
  }
});

test('query aceita WITH (CTE) como consulta válida', async () => {
  const rows = await query(`
    WITH temp AS (SELECT 1 AS num FROM SYSIBM.SYSDUMMY1)
    SELECT * FROM temp
  `);
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].NUM), 1);
});
