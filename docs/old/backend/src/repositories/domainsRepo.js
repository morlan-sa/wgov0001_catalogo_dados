import { listDominiosNegocio } from '../services/inference.js';
import { listSchemas } from './schemasRepo.js';

export async function listDomainsWithUsage() {
  const domains = listDominiosNegocio();
  const schemas = await listSchemas();

  return domains
    .map((d) => {
      const schemasForDomain = schemas.filter((s) => s.dominio.code === d.code);
      const objectCount = schemasForDomain.reduce((sum, s) => sum + s.tableCount + s.viewCount, 0);
      return {
        code: d.code,
        name: d.name,
        schemaCount: schemasForDomain.length,
        objectCount,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
