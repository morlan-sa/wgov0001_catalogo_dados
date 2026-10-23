import { query } from '../db/pool.js';
import { inferClassificacao } from '../services/inference.js';

export async function listTables(schema) {
  const sql = `
    SELECT TABNAME, TYPE, REMARKS
    FROM SYSCAT.TABLES
    WHERE TABSCHEMA = ? AND TYPE IN ('T', 'V')
    ORDER BY TABNAME
  `;
  const rows = await query(sql, [schema]);
  return rows.map((row) => {
    const remarks = row.REMARKS ? row.REMARKS.trim() : null;
    return {
      name: row.TABNAME.trim(),
      type: row.TYPE.trim() === 'V' ? 'View' : 'Tabela',
      description: remarks,
      classification: inferClassificacao(remarks),
    };
  });
}
