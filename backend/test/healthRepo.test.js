import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSaudeGovernanca } from '../src/repositories/healthRepo.js';

test('getSaudeGovernanca calcula a media de saude so das tabelas governadas (STG/CUR/RPT)', async () => {
  const result = await getSaudeGovernanca();

  assert.ok(result.totalTabelasAvaliadas > 0, 'deveria haver tabelas governadas para avaliar');
  assert.ok(result.percentual >= 0 && result.percentual <= 100);
  assert.ok(['Excelente', 'Bom', 'Atenção'].includes(result.classificacao));
});
