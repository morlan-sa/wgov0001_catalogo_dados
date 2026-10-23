import { Router } from 'express';
import { listDomainsWithUsage } from '../repositories/domainsRepo.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const domains = await listDomainsWithUsage();
    res.json(domains);
  } catch (err) {
    next(err);
  }
});

export default router;
