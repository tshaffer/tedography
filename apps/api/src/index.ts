import { createServer } from './server.js';
import { connectToMongo } from './db.js';
import { config } from './config.js';
import { log } from './logger.js';
import { syncMediaAssetIndexes } from './repositories/assetRepository.js';
import { syncAlbumTreeNodeIndexes } from './repositories/albumTreeRepository.js';

await connectToMongo();

await syncMediaAssetIndexes();
await syncAlbumTreeNodeIndexes();

const app = createServer();

const server = app.listen(config.port, () => {
  log.info(`Tedography API running on http://localhost:${config.port}`);
});

void server;
