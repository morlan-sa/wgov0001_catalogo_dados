import { query } from '../db/pool.js';
import { inferCompletude } from '../services/inference.js';

const IDENTIFIER_RE = /^[A-Z0-9_]+$/;

const TEXT_TYPE_RE = /CHAR|CLOB|GRAPHIC/i;

function buildCompletudeSql(schema, table, columns) {
  const countExprs = columns.map((c) => {
    if (!IDENTIFIER_RE.test(c.name)) {
      throw new Error(`Nome de coluna inválido: ${c.name}`);
    }
    const col = `"${c.name}"`;
    return TEXT_TYPE_RE.test(c.type)
      ? `COUNT(NULLIF(TRIM(${col}), '')) AS ${col}`
      : `COUNT(${col}) AS ${col}`;
  });
  return `SELECT COUNT(*) AS "TOTAL_REGISTROS", ${countExprs.join(', ')} FROM "${schema}"."${table}"`;
}

export async function getCompletude(schema, table, columns) {
  if (!IDENTIFIER_RE.test(schema) || !IDENTIFIER_RE.test(table)) {
    throw new Error(`Schema ou tabela inválidos: ${schema}.${table}`);
  }
  if (columns.length === 0) {
    return { totalRegistros: 0, porColuna: {} };
  }

  const sql = buildCompletudeSql(schema, table, columns);
  const [row] = await query(sql);
  const totalRegistros = Number(row.TOTAL_REGISTROS);

  const porColuna = {};
  for (const c of columns) {
    const preenchidos = Number(row[c.name]);
    const percentual = totalRegistros === 0 ? 100 : Math.round((preenchidos / totalRegistros) * 100);
    porColuna[c.name] = { percentual, classificacao: inferCompletude(percentual) };
  }
  return { totalRegistros, porColuna };
}
