import { Router } from 'express';
import { listSchemas } from '../repositories/schemasRepo.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const schemas = await listSchemas();
    res.json(schemas);
  } catch (err) {
    next(err);
  }
});

export default router;
