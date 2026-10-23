import { Router } from 'express';
import { listSchemas } from '../repositories/schemasRepo.js';
import { getSaudeGovernanca, getSaudeLegado } from '../repositories/healthRepo.js';

const router = Router();

router.get('/summary', async (req, res, next) => {
  try {
    const schemas = await listSchemas();
    const totalSchemas = schemas.length;
    const totalTables = schemas.reduce((sum, s) => sum + s.tableCount, 0);
    const totalViews = schemas.reduce((sum, s) => sum + s.viewCount, 0);
    const porCamada = schemas.reduce((acc, s) => {
      acc[s.camada] = (acc[s.camada] || 0) + s.tableCount + s.viewCount;
      return acc;
    }, {});
    res.json({ totalSchemas, totalTables, totalViews, porCamada });
  } catch (err) {
    next(err);
  }
});

router.get('/saude', async (req, res, next) => {
  try {
    const saude = await getSaudeGovernanca();
    res.json(saude);
  } catch (err) {
    next(err);
  }
});

router.get('/saude-legado', async (req, res, next) => {
  try {
    const saude = await getSaudeLegado();
    res.json(saude);
  } catch (err) {
    next(err);
  }
});

export default router;
