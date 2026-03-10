import 'dotenv/config';
import { createServer } from './server.js';
import { connectToMongo } from './db.js';
import { seedMediaAssetsIfEmpty } from './seedMediaAssets.js';

async function main(): Promise<void> {
  await connectToMongo();
  await seedMediaAssetsIfEmpty();

  const app = createServer();
  const port = Number(process.env.PORT ?? 4000);

  const server = app.listen(port, () => {
    console.log(`[src] Tedography API running on http://localhost:${port}`);
  });

  void server;
}

void main().catch((error: unknown) => {
  console.error('[src] Failed to start API', error);
  process.exit(1);
});
