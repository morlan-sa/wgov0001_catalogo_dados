import { query } from '../db/pool.js';
import { inferPrefixDomain } from '../services/inference.js';

const COLUMNS_SQL = `
  SELECT COLNAME, TYPENAME, LENGTH, SCALE, NULLS, COLNO, REMARKS
  FROM SYSCAT.COLUMNS
  WHERE TABSCHEMA = ? AND TABNAME = ?
  ORDER BY COLNO
`;

const PK_SQL = `
  SELECT K.COLNAME
  FROM SYSCAT.TABCONST T
  JOIN SYSCAT.KEYCOLUSE K
    ON T.CONSTNAME = K.CONSTNAME AND T.TABSCHEMA = K.TABSCHEMA AND T.TABNAME = K.TABNAME
  WHERE T.TABSCHEMA = ? AND T.TABNAME = ? AND T.TYPE = 'P'
`;

export async function listColumns(schema, table) {
  const [columnRows, pkRows] = await Promise.all([
    query(COLUMNS_SQL, [schema, table]),
    query(PK_SQL, [schema, table]),
  ]);
  const pkNames = new Set(pkRows.map((r) => r.COLNAME.trim()));

  return columnRows.map((row) => {
    const name = row.COLNAME.trim();
    return {
      name,
      type: row.TYPENAME.trim(),
      length: row.LENGTH,
      scale: row.SCALE,
      nullable: row.NULLS.trim() === 'Y',
      order: row.COLNO,
      description: row.REMARKS ? row.REMARKS.trim() : null,
      isPrimaryKey: pkNames.has(name),
      domain: inferPrefixDomain(name),
    };
  });
}
