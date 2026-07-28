import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCompletude } from '../src/repositories/completenessRepo.js';
import { listColumns } from '../src/repositories/columnsRepo.js';

test('getCompletude calcula percentual real de preenchimento em CUR_REF.PAIS', async () => {
  const columns = await listColumns('CUR_REF', 'PAIS');
  const result = await getCompletude('CUR_REF', 'PAIS', columns);

  assert.equal(result.totalRegistros, 252);

  const idPais = result.porColuna.ID_PAIS;
  assert.ok(idPais);
  assert.equal(idPais.percentual, 100);
  assert.equal(idPais.classificacao, 'Excelente');

  const cdPaisIso = result.porColuna.CD_PAIS_ISO;
  assert.ok(cdPaisIso);
  assert.equal(cdPaisIso.percentual, Math.round((248 / 252) * 100));
  assert.equal(cdPaisIso.classificacao, 'Excelente');
});

test('getCompletude rejeita schema/tabela com caracteres fora do padrao de identificador', async () => {
  const columns = [{ name: 'ID_PAIS', type: 'BIGINT' }];
  await assert.rejects(() => getCompletude('CUR_REF; DROP TABLE X', 'PAIS', columns));
  await assert.rejects(() => getCompletude('CUR_REF', "PAIS'; DROP TABLE X; --", columns));
});

test('getCompletude retorna vazio quando a lista de colunas esta vazia', async () => {
  const result = await getCompletude('CUR_REF', 'PAIS', []);
  assert.deepEqual(result, { totalRegistros: 0, porColuna: {} });
});
