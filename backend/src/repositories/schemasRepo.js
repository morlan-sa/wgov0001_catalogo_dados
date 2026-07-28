import { query } from '../db/pool.js';
import { inferCamada, inferDominio } from '../services/inference.js';

export async function listSchemas() {
  const sql = `
    SELECT
      TABSCHEMA,
      COUNT(CASE WHEN TYPE = 'T' THEN 1 END) AS QTD_TABELAS,
      COUNT(CASE WHEN TYPE = 'V' THEN 1 END) AS QTD_VIEWS
    FROM SYSCAT.TABLES
    WHERE TYPE IN ('T', 'V') AND TABSCHEMA NOT LIKE 'SYS%'
    GROUP BY TABSCHEMA
    ORDER BY TABSCHEMA
  `;
  const rows = await query(sql);
  return rows.map((row) => {
    const schema = row.TABSCHEMA.trim();
    return {
      schema,
      tableCount: Number(row.QTD_TABELAS),
      viewCount: Number(row.QTD_VIEWS),
      camada: inferCamada(schema),
      dominio: inferDominio(schema),
    };
  });
}
