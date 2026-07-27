import { Router } from 'express';
import { listSchemas } from '../repositories/schemasRepo.js';

const router = Router();

router.get('/summary', async (req, res, next) => {
  try {
    const schemas = await listSchemas();
    const totalSchemas = schemas.length;
    const totalTables = schemas.reduce((sum, s) => sum + s.tableCount, 0);
    const porCamada = schemas.reduce((acc, s) => {
      acc[s.camada] = (acc[s.camada] || 0) + s.tableCount;
      return acc;
    }, {});
    res.json({ totalSchemas, totalTables, porCamada });
  } catch (err) {
    next(err);
  }
});

export default router;
