import { query } from '../db/pool.js';

const RESULT_LIMIT = 200;

export async function searchColumns(term, schemas) {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const conditions = [
    "T.TYPE IN ('T', 'V')",
    "T.TABSCHEMA NOT LIKE 'SYS%'",
    'UPPER(C.COLNAME) LIKE ?',
  ];
  const params = [`%${trimmed.toUpperCase()}%`];

  if (schemas && schemas.length > 0) {
    conditions.push(`T.TABSCHEMA IN (${schemas.map(() => '?').join(',')})`);
    params.push(...schemas);
  }

  const sql = `
    SELECT C.TABSCHEMA, C.TABNAME, C.COLNAME, C.TYPENAME, C.REMARKS
    FROM SYSCAT.COLUMNS C
    JOIN SYSCAT.TABLES T ON T.TABSCHEMA = C.TABSCHEMA AND T.TABNAME = C.TABNAME
    WHERE ${conditions.join(' AND ')}
    ORDER BY C.TABSCHEMA, C.TABNAME, C.COLNAME
    FETCH FIRST ${RESULT_LIMIT} ROWS ONLY
  `;
  const rows = await query(sql, params);
  return rows.map((row) => ({
    schema: row.TABSCHEMA.trim(),
    table: row.TABNAME.trim(),
    column: row.COLNAME.trim(),
    type: row.TYPENAME.trim(),
    description: row.REMARKS ? row.REMARKS.trim() : null,
  }));
}
