import { query } from '../db/pool.js';
import { inferCompletude, isAuditColumn } from '../services/inference.js';

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
  const selectList = ['COUNT(*) AS "TOTAL_REGISTROS"', ...countExprs].join(', ');
  return `SELECT ${selectList} FROM "${schema}"."${table}"`;
}

function calcularSaude(porColuna) {
  const percentuais = Object.values(porColuna).map((c) => c.percentual);
  if (percentuais.length === 0) {
    return { percentual: 100, classificacao: inferCompletude(100) };
  }
  const media = Math.round(percentuais.reduce((soma, p) => soma + p, 0) / percentuais.length);
  return { percentual: media, classificacao: inferCompletude(media) };
}

export async function getCompletude(schema, table, columns) {
  if (!IDENTIFIER_RE.test(schema) || !IDENTIFIER_RE.test(table)) {
    throw new Error(`Schema ou tabela inválidos: ${schema}.${table}`);
  }
  if (columns.length === 0) {
    return { totalRegistros: 0, porColuna: {}, saude: { percentual: 100, classificacao: 'Excelente' } };
  }

  // Colunas de auditoria/governança (NM_ORIGEM_GRAVACAO, DT_ATU_DADOS etc., conforme a
  // skill de governança) ficam de fora da completude: são metadados de controle do ETL,
  // não dados de negócio - um registro nunca atualizado ter DT_ATU_DADOS vazio é normal,
  // não é um problema de qualidade de dado.
  const relevantColumns = columns.filter((c) => !isAuditColumn(c.name));

  const sql = buildCompletudeSql(schema, table, relevantColumns);
  const [row] = await query(sql);
  const totalRegistros = Number(row.TOTAL_REGISTROS);

  const porColuna = {};
  for (const c of relevantColumns) {
    const preenchidos = Number(row[c.name]);
    const percentual = totalRegistros === 0 ? 100 : Math.round((preenchidos / totalRegistros) * 100);
    porColuna[c.name] = { percentual, classificacao: inferCompletude(percentual) };
  }

  return { totalRegistros, porColuna, saude: calcularSaude(porColuna) };
}
