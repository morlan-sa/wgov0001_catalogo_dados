import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferCamada, inferDominio, inferClassificacao, inferPrefixDomain } from '../src/services/inference.js';

test('inferCamada reconhece prefixos governados', () => {
  assert.equal(inferCamada('STG_ERP'), 'STG');
  assert.equal(inferCamada('CUR_COM'), 'CUR');
  assert.equal(inferCamada('RPT_FIS'), 'RPT');
});

test('inferCamada classifica schema fora do padrao como LEGADO', () => {
  assert.equal(inferCamada('RCHUMANO'), 'LEGADO');
  assert.equal(inferCamada('COMPRAS'), 'LEGADO');
});

test('inferDominio reconhece sufixo de dominio cadastrado', () => {
  assert.deepEqual(inferDominio('CUR_COM'), { code: 'COM', name: 'Comercial' });
  assert.deepEqual(inferDominio('RPT_FIS'), { code: 'FIS', name: 'Fiscal' });
});

test('inferDominio cai em Nao classificado quando sufixo nao bate', () => {
  assert.deepEqual(inferDominio('STG_ERP'), { code: 'NC', name: 'Não classificado' });
  assert.deepEqual(inferDominio('COMPRAS'), { code: 'NC', name: 'Não classificado' });
});

test('inferClassificacao le o padrao Classificacao: X no remarks', () => {
  assert.equal(inferClassificacao('Importador - dado sensivel. Classificacao: RESTRITO'), 'Restrito');
  assert.equal(inferClassificacao('NCM - referencia fiscal. Classificação: PUBLICO'), 'Público');
});

test('inferClassificacao tolera encoding corrompido nos acentos', () => {
  assert.equal(inferClassificacao('Classifica��o: SIGILOSO'), 'Sigiloso');
});

test('inferClassificacao retorna Nao classificado quando remarks e nulo ou sem padrao', () => {
  assert.equal(inferClassificacao(null), 'Não classificado');
  assert.equal(inferClassificacao('Uma tabela qualquer sem marcacao'), 'Não classificado');
});

test('inferPrefixDomain reconhece prefixos de coluna cadastrados', () => {
  assert.equal(inferPrefixDomain('ID_IMPORTADOR'), 'Identificador');
  assert.equal(inferPrefixDomain('NR_CNPJ'), 'Número');
  assert.equal(inferPrefixDomain('NM_IMPORTADOR'), 'Nome');
  assert.equal(inferPrefixDomain('DT_GRAV_DADOS'), 'Data');
  assert.equal(inferPrefixDomain('IN_ATIVO'), 'Indicador');
  assert.equal(inferPrefixDomain('DS_HASH_LINHA'), 'Descrição');
  assert.equal(inferPrefixDomain('CD_PAIS'), 'Código');
  assert.equal(inferPrefixDomain('VR_TOTAL'), 'Valor Monetário');
});

test('inferPrefixDomain retorna Nao classificado para prefixo desconhecido', () => {
  assert.equal(inferPrefixDomain('FOOBAR_XYZ'), 'Não classificado');
  assert.equal(inferPrefixDomain('SEMPREFIXO'), 'Não classificado');
});
