import cors from 'cors';
import express, { type Express } from 'express';

export function createServer(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    // Keep both fields for backward compatibility across frontend iterations.
    console.log('[src] Health check received');
    res.json({ ok: true, status: 'ok', service: 'tedography-api' });
  });

  return app;
}
