import { listSchemas } from './schemasRepo.js';
import { listTables } from './tablesRepo.js';
import { listColumns } from './columnsRepo.js';
import { getCompletude } from './completenessRepo.js';
import { inferCompletude } from '../services/inference.js';

const CONCURRENCY = 6;

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

// Saúde da governança é calculada só sobre os schemas governados (STG_/CUR_/RPT_),
// não sobre os schemas legados - são poucas tabelas (conjunto pequeno e rápido de
// avaliar), e "saúde da governança" só faz sentido sobre o que de fato passou pelo
// processo de governança; tabelas legadas nunca seguiram essas convenções.
export async function getSaudeGovernanca() {
  const schemas = await listSchemas();
  const governados = schemas.filter((s) => s.camada !== 'LEGADO');

  const tabelasPorSchema = await Promise.all(
    governados.map(async (s) => {
      const tabelas = await listTables(s.schema);
      return tabelas.map((t) => ({ schema: s.schema, table: t.name }));
    })
  );
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
    porSchema: agruparPorSchema(resultadosPorTabela),
  };
}
