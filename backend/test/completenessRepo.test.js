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

test('getCompletude nao inclui colunas de auditoria (NM_ORIGEM_GRAVACAO etc.) na completude', async () => {
  const columns = await listColumns('CUR_REF', 'PAIS');
  const result = await getCompletude('CUR_REF', 'PAIS', columns);

  for (const auditCol of [
    'NM_ORIGEM_GRAVACAO',
    'DT_GRAV_DADOS',
    'NM_ORIGEM_ALTERACAO',
    'DT_ATU_DADOS',
    'IN_ATIVO',
    'DS_HASH_LINHA',
  ]) {
    assert.equal(
      result.porColuna[auditCol],
      undefined,
      `${auditCol} é coluna de auditoria e não deveria ter completude calculada`
    );
  }
});

test('getCompletude calcula a saude geral da tabela como media das colunas relevantes', async () => {
  const columns = await listColumns('CUR_REF', 'PAIS');
  const result = await getCompletude('CUR_REF', 'PAIS', columns);

  // ID_PAIS=100, CD_PAIS=100, CD_PAIS_ISO=98, NM_PAIS=100 (colunas de auditoria excluidas)
  assert.ok(result.saude);
  assert.equal(result.saude.percentual, 100);
  assert.equal(result.saude.classificacao, 'Excelente');
});

test('getCompletude rejeita schema/tabela com caracteres fora do padrao de identificador', async () => {
  const columns = [{ name: 'ID_PAIS', type: 'BIGINT' }];
  await assert.rejects(() => getCompletude('CUR_REF; DROP TABLE X', 'PAIS', columns));
  await assert.rejects(() => getCompletude('CUR_REF', "PAIS'; DROP TABLE X; --", columns));
});

test('getCompletude retorna vazio quando a lista de colunas esta vazia', async () => {
  const result = await getCompletude('CUR_REF', 'PAIS', []);
  assert.deepEqual(result, {
    totalRegistros: 0,
    porColuna: {},
    saude: { percentual: 100, classificacao: 'Excelente' },
  });
});
