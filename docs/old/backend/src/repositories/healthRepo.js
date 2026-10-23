import { query } from '../db/pool.js';
import { listSchemas } from './schemasRepo.js';
import { listTables } from './tablesRepo.js';
import { listColumns } from './columnsRepo.js';
import { getCompletude } from './completenessRepo.js';
import { inferCompletude } from '../services/inference.js';

const CONCURRENCY = 6;
const LEGACY_CONCURRENCY = 8;
const LEGACY_SAMPLE_SIZE = 5;
const LEGACY_CANDIDATE_POOL = 20;
const LEGACY_QUERY_TIMEOUT_MS = 5000;

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function agruparPorSchema(resultadosPorTabela) {
  const grupos = new Map();
  for (const r of resultadosPorTabela) {
    if (!grupos.has(r.schema)) grupos.set(r.schema, []);
    grupos.get(r.schema).push(r.percentual);
  }
  return Array.from(grupos.entries())
    .map(([schema, percentuais]) => {
      const media = Math.round(percentuais.reduce((soma, p) => soma + p, 0) / percentuais.length);
      return {
        schema,
        percentual: media,
        classificacao: inferCompletude(media),
        totalTabelas: percentuais.length,
      };
    })
    .sort((a, b) => a.schema.localeCompare(b.schema));
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`tempo esgotado após ${ms}ms`)), ms)),
  ]);
}

const IDENTIFIER_RE = /^[A-Z0-9_]+$/;

// Candidatas às MENORES tabelas (SYSCAT.TABLES.CARD) primeiro - permite amostrar tabelas
// pequenas/rápidas de escanear em vez de arriscar cair numa tabela de milhões de linhas.
// CARD < 0 significa "sem estatística coletada" - tratado como grande (vai para o fim da
// lista) já que o tamanho real é desconhecido. Só TYPE='T' (tabelas reais): views legadas
// costumam ser objetos de monitoração/BI (ex.: LOCKS_COUNT, SESSOES_ABERTAS) sem permissão
// de SELECT para devlucas, e não representam "dados reais" de negócio de qualquer forma.
// Busca um POOL de candidatas (não só o tamanho final da amostra) porque algumas vão falhar
// por permissão - o chamador tenta a próxima candidata até completar a amostra.
async function listCandidatasMenoresTabelas(schema, poolSize) {
  if (!IDENTIFIER_RE.test(schema)) {
    throw new Error(`Schema inválido: ${schema}`);
  }
  const sql = `
    SELECT TABNAME
    FROM SYSCAT.TABLES
    WHERE TABSCHEMA = ? AND TYPE = 'T'
    ORDER BY CASE WHEN CARD < 0 THEN 999999999 ELSE CARD END ASC
    FETCH FIRST ${Number(poolSize)} ROWS ONLY
  `;
  const rows = await query(sql, [schema]);
  return rows.map((row) => row.TABNAME.trim());
}

// Tenta as candidatas em ordem (menor CARD primeiro) até completar o tamanho da amostra ou
// esgotar o pool. Uma candidata que falha (permissão negada, timeout, etc.) é descartada e a
// próxima é tentada - assim um schema só fica sem amostra se TODAS as candidatas falharem,
// não só as N primeiras.
async function amostrarSchemaLegado(schema) {
  const candidatas = await listCandidatasMenoresTabelas(schema, LEGACY_CANDIDATE_POOL);
  const amostra = [];
  for (const table of candidatas) {
    if (amostra.length >= LEGACY_SAMPLE_SIZE) break;
    try {
      const columns = await withTimeout(listColumns(schema, table), LEGACY_QUERY_TIMEOUT_MS);
      const completude = await withTimeout(getCompletude(schema, table, columns), LEGACY_QUERY_TIMEOUT_MS);
      amostra.push({ schema, table, percentual: completude.saude.percentual });
    } catch {
      // candidata imprevistamente lenta ou sem permissão - tenta a próxima
    }
  }
  return amostra;
}

// Saúde da governança é calculada só sobre os schemas governados (STG_/CUR_/RPT_),
// não sobre os schemas legados - são poucas tabelas (conjunto pequeno e rápido de
// avaliar), e "saúde da governança" só faz sentido sobre o que de fato passou pelo
// processo de governança; tabelas legadas nunca seguiram essas convenções.
export async function getSaudeGovernanca() {
  const schemas = await listSchemas();
  const governados = schemas.filter((s) => s.camada !== 'LEGADO');

  const tabelasPorSchema = await mapWithConcurrency(governados, CONCURRENCY, async (s) => {
    const tabelas = await listTables(s.schema);
    return tabelas.map((t) => ({ schema: s.schema, table: t.name }));
  });
  const todasTabelas = tabelasPorSchema.flat();

  if (todasTabelas.length === 0) {
    return { percentual: 100, classificacao: inferCompletude(100), totalTabelasAvaliadas: 0, porSchema: [] };
  }

  const resultadosPorTabela = await mapWithConcurrency(todasTabelas, CONCURRENCY, async ({ schema, table }) => {
    const columns = await listColumns(schema, table);
    const completude = await getCompletude(schema, table, columns);
    return { schema, table, percentual: completude.saude.percentual };
  });

  const media = Math.round(
    resultadosPorTabela.reduce((soma, r) => soma + r.percentual, 0) / resultadosPorTabela.length
  );

  return {
    percentual: media,
    classificacao: inferCompletude(media),
    totalTabelasAvaliadas: todasTabelas.length,
    metrica: 'completude_dados',
    porSchema: agruparPorSchema(resultadosPorTabela),
  };
}

// Mesma métrica dos schemas governados (% real de preenchimento dos dados), mas os
// schemas legados podem ter tabelas com milhões de linhas - escanear TODAS as tabelas de
// TODOS os ~3000 objetos legados é inviável (uma única tabela de 8,5M linhas levou ~13s só
// para essa consulta). Para manter a MESMA métrica sem travar o dashboard, avalia uma
// amostra das tabelas MENORES de cada schema (via SYSCAT.TABLES.CARD), com um timeout por
// consulta como rede de segurança (uma tabela imprevistamente lenta é descartada da
// amostra, não trava as demais).
export async function getSaudeLegado() {
  const schemas = await listSchemas();
  const legados = schemas.filter((s) => s.camada === 'LEGADO');

  const amostraPorSchema = await mapWithConcurrency(legados, LEGACY_CONCURRENCY, (s) => amostrarSchemaLegado(s.schema));
  const resultados = amostraPorSchema.flat();

  // Alguns schemas legados são inteiramente inacessíveis para leitura (devlucas não tem
  // privilégio SELECT em nenhuma tabela deles - ex.: DB2INST1, MORLANWEB, BI, ISO) - não é
  // falha da amostragem, é um limite real de permissão. Reportado à parte para não passar a
  // falsa impressão de que só existem os schemas que aparecem em porSchema.
  const schemasComAmostra = new Set(resultados.map((r) => r.schema));
  const schemasSemAcesso = legados
    .map((s) => s.schema)
    .filter((schema) => !schemasComAmostra.has(schema))
    .sort();

  if (resultados.length === 0) {
    return {
      percentual: 100,
      classificacao: inferCompletude(100),
      totalTabelasAvaliadas: 0,
      metrica: 'completude_dados',
      amostraPorSchema: LEGACY_SAMPLE_SIZE,
      porSchema: [],
      schemasSemAcesso,
    };
  }

  const media = Math.round(resultados.reduce((soma, r) => soma + r.percentual, 0) / resultados.length);

  return {
    percentual: media,
    classificacao: inferCompletude(media),
    totalTabelasAvaliadas: resultados.length,
    metrica: 'completude_dados',
    amostraPorSchema: LEGACY_SAMPLE_SIZE,
    porSchema: agruparPorSchema(resultados),
    schemasSemAcesso,
  };
}
