import { createServer } from './server.js';
import { connectToMongo } from './db.js';
import { seedMediaAssetsIfEmpty } from './seedMediaAssets.js';
import { config } from './config.js';

await connectToMongo();

await seedMediaAssetsIfEmpty();

const app = createServer();

const server = app.listen(config.port, () => {
  console.log(`[src] Tedography API running on http://localhost:${config.port}`);
});

void server;