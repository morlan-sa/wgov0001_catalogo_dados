import express from 'express';
import cors from 'cors';
import schemasRouter from './routes/schemas.js';
import catalogRouter from './routes/catalog.js';
import dashboardRouter from './routes/dashboard.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/schemas', schemasRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/dashboard', dashboardRouter);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erro interno' });
  });

  return app;
}
