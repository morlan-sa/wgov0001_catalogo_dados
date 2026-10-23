import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listDomainsWithUsage } from '../src/repositories/domainsRepo.js';

test('listDomainsWithUsage retorna os 24 dominios com uso real no DB2', async () => {
  const domains = await listDomainsWithUsage();
  assert.equal(domains.length, 24);

  const comercial = domains.find((d) => d.code === 'COM');
  assert.ok(comercial);
  assert.equal(comercial.name, 'Comercial');
  assert.ok(comercial.schemaCount >= 2, 'Comercial deveria ter CUR_COM e RPT_COM');
  assert.ok(comercial.objectCount >= 2);

  const financeiro = domains.find((d) => d.code === 'FIN');
  assert.ok(financeiro);
  assert.equal(financeiro.schemaCount, 0, 'nenhum schema CUR_FIN/RPT_FIN existe hoje no DB2 dev');
  assert.equal(financeiro.objectCount, 0);
});

test('listDomainsWithUsage retorna ordenado alfabeticamente pelo nome', async () => {
  const domains = await listDomainsWithUsage();
  const names = domains.map((d) => d.name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  assert.deepEqual(names, sorted);
});
