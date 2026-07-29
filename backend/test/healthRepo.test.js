import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSaudeGovernanca, getSaudeLegado } from '../src/repositories/healthRepo.js';

test('getSaudeGovernanca calcula a media de saude so das tabelas governadas (STG/CUR/RPT)', async () => {
  const result = await getSaudeGovernanca();

  assert.ok(result.totalTabelasAvaliadas > 0, 'deveria haver tabelas governadas para avaliar');
  assert.ok(result.percentual >= 0 && result.percentual <= 100);
  assert.ok(['Excelente', 'Bom', 'Atenção'].includes(result.classificacao));
});

test('getSaudeGovernanca retorna a saude quebrada por schema, ordenada alfabeticamente', async () => {
  const result = await getSaudeGovernanca();

  assert.ok(Array.isArray(result.porSchema));
  assert.ok(result.porSchema.length > 0);

  const nomes = result.porSchema.map((s) => s.schema);
  assert.deepEqual(nomes, [...nomes].sort());

  const curCom = result.porSchema.find((s) => s.schema === 'CUR_COM');
  assert.ok(curCom, 'CUR_COM deveria aparecer na quebra por schema');
  assert.equal(curCom.totalTabelas, 1);
  assert.ok(curCom.percentual >= 0 && curCom.percentual <= 100);
  assert.ok(['Excelente', 'Bom', 'Atenção'].includes(curCom.classificacao));

  // a media geral deve ser consistente com a media das medias por schema (ambas vem
  // do mesmo conjunto de tabelas avaliadas nesta mesma chamada)
  const totalTabelasNaQuebra = result.porSchema.reduce((soma, s) => soma + s.totalTabelas, 0);
  assert.equal(totalTabelasNaQuebra, result.totalTabelasAvaliadas);
});

test('getSaudeLegado calcula cobertura de documentacao por schema legado (sem varrer dados)', async () => {
  const result = await getSaudeLegado();

  assert.equal(result.metrica, 'documentacao');
  assert.ok(result.totalTabelasAvaliadas > 1000, 'deveria contar milhares de tabelas legadas');
  assert.ok(result.percentual >= 0 && result.percentual <= 100);
  assert.ok(['Excelente', 'Bom', 'Atenção'].includes(result.classificacao));

  assert.ok(Array.isArray(result.porSchema));
  assert.ok(result.porSchema.length > 40, 'deveria haver dezenas de schemas legados');

  const nomes = result.porSchema.map((s) => s.schema);
  assert.deepEqual(nomes, [...nomes].sort());
  assert.ok(!nomes.includes('CUR_COM'), 'schema governado não deveria aparecer no legado');

  const compras = result.porSchema.find((s) => s.schema === 'COMPRAS');
  assert.ok(compras);
  assert.ok(compras.totalTabelas > 100);
});
