import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listSchemas } from '../src/repositories/schemasRepo.js';

test('listSchemas retorna schemas reais do DB2 dev com contagem de tabelas', async () => {
  const schemas = await listSchemas();
  assert.ok(Array.isArray(schemas));
  assert.ok(schemas.length > 10, 'deveria haver mais de 10 schemas no DB2 dev');

  const curCom = schemas.find((s) => s.schema === 'CUR_COM');
  assert.ok(curCom, 'CUR_COM deveria aparecer na lista de schemas');
  assert.equal(curCom.camada, 'CUR');
  assert.deepEqual(curCom.dominio, { code: 'COM', name: 'Comercial' });
  assert.equal(curCom.tableCount, 1);
  assert.equal(curCom.viewCount, 0);

  const legado = schemas.find((s) => s.schema === 'COMPRAS');
  assert.ok(legado, 'COMPRAS deveria aparecer na lista de schemas');
  assert.equal(legado.camada, 'LEGADO');
  assert.deepEqual(legado.dominio, { code: 'NC', name: 'Não classificado' });
  assert.ok(legado.tableCount >= 1);
  assert.ok(legado.viewCount >= 1, 'COMPRAS deveria ter pelo menos 1 view');
});

test('listSchemas nao inclui os schemas de sistema do DB2 (SYS*)', async () => {
  const schemas = await listSchemas();
  const sysSchemas = schemas.filter((s) => s.schema.startsWith('SYS'));
  assert.deepEqual(sysSchemas, [], 'schemas SYSCAT/SYSIBM/etc. nao deveriam aparecer no catalogo');
});
