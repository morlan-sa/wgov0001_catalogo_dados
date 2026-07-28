import { Router } from 'express';
import { listSchemas } from '../repositories/schemasRepo.js';
import { listTables } from '../repositories/tablesRepo.js';
import { listColumns } from '../repositories/columnsRepo.js';
import { getCompletude } from '../repositories/completenessRepo.js';

const router = Router();

router.get('/schemas', async (req, res, next) => {
  try {
    const filterParam = req.query.filter;
    const filter = filterParam
      ? filterParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : null;
    const schemas = await listSchemas();
    const filtered = filter ? schemas.filter((s) => filter.includes(s.schema)) : schemas;
    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

router.get('/schemas/:schema/tables', async (req, res, next) => {
  try {
    const tables = await listTables(req.params.schema.toUpperCase());
    res.json(tables);
  } catch (err) {
    next(err);
  }
});

router.get('/schemas/:schema/tables/:table', async (req, res, next) => {
  try {
    const schema = req.params.schema.toUpperCase();
    const table = req.params.table.toUpperCase();

    const tables = await listTables(schema);
    const tableInfo = tables.find((t) => t.name === table);
    if (!tableInfo) {
      return res.status(404).json({ error: `Tabela ${schema}.${table} não encontrada` });
    }

    const columns = await listColumns(schema, table);
    const completude = await getCompletude(schema, table, columns);
    const columnsComCompletude = columns.map((c) => ({
      ...c,
      completude: completude.porColuna[c.name] ?? null,
    }));

    res.json({
      ...tableInfo,
      schema,
      totalRegistros: completude.totalRegistros,
      columns: columnsComCompletude,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
