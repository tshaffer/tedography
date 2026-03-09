import cors from 'cors';
import express from 'express';

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'tedography-api' });
  });

  return app;
}
