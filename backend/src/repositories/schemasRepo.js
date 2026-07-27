import { query } from '../db/pool.js';
import { inferCamada, inferDominio } from '../services/inference.js';

export async function listSchemas() {
  const sql = `
    SELECT TABSCHEMA, COUNT(*) AS QTD_TABELAS
    FROM SYSCAT.TABLES
    WHERE TYPE IN ('T', 'V')
    GROUP BY TABSCHEMA
    ORDER BY TABSCHEMA
  `;
  const rows = await query(sql);
  return rows.map((row) => {
    const schema = row.TABSCHEMA.trim();
    return {
      schema,
      tableCount: Number(row.QTD_TABELAS),
      camada: inferCamada(schema),
      dominio: inferDominio(schema),
    };
  });
}
