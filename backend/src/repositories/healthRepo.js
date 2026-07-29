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

// Schemas legados nunca passaram pelo processo de governança e podem ter tabelas com
// milhões de linhas - medir "completude de dados" real exigiria uma varredura completa
// por tabela (confirmado: uma única tabela de 8,5M linhas levou ~13s só para essa
// consulta), o que é inviável para milhares de tabelas legadas de uma vez. Para o
// legado, a saúde usa uma métrica diferente e honesta: % de tabelas com descrição
// (REMARKS) cadastrada no DB2 - vem só do catálogo (SYSCAT.TABLES), sem tocar os
// dados, então é rápido mesmo para schemas enormes.
export async function getSaudeLegado() {
  const schemas = await listSchemas();
  const legados = schemas.filter((s) => s.camada === 'LEGADO');

  // Mesmo sendo consultas rápidas de catálogo (sem varrer dados), disparar uma conexão
  // por schema de uma vez (Promise.all sem limite, 55+ schemas) já se mostrou capaz de
  // esgotar conexões do DB2 quando outras suítes rodam em paralelo - por isso usa o
  // mesmo limitador de concorrência das consultas mais pesadas.
  const tabelasPorSchema = await mapWithConcurrency(legados, CONCURRENCY, async (s) => ({
    schema: s.schema,
    tabelas: await listTables(s.schema),
  }));

  const porSchema = [];
  let totalTabelas = 0;
  let totalComDescricao = 0;

  for (const { schema, tabelas } of tabelasPorSchema) {
    if (tabelas.length === 0) continue;
    const comDescricao = tabelas.filter((t) => t.description).length;
    const percentual = Math.round((comDescricao / tabelas.length) * 100);
    porSchema.push({
      schema,
      percentual,
      classificacao: inferCompletude(percentual),
      totalTabelas: tabelas.length,
    });
    totalTabelas += tabelas.length;
    totalComDescricao += comDescricao;
  }

  const percentualGeral = totalTabelas === 0 ? 100 : Math.round((totalComDescricao / totalTabelas) * 100);

  return {
    percentual: percentualGeral,
    classificacao: inferCompletude(percentualGeral),
    totalTabelasAvaliadas: totalTabelas,
    metrica: 'documentacao',
    porSchema: porSchema.sort((a, b) => a.schema.localeCompare(b.schema)),
  };
}
