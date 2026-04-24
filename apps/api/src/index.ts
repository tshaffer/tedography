import { createServer } from './server.js';
import { connectToMongo } from './db.js';
import { config } from './config.js';
import { log } from './logger.js';
import { syncMediaAssetIndexes } from './repositories/assetRepository.js';
import { syncAlbumTreeNodeIndexes } from './repositories/albumTreeRepository.js';
import { syncFaceDetectionIndexes } from './repositories/faceDetectionRepository.js';
import { syncFaceMatchReviewIndexes } from './repositories/faceMatchReviewRepository.js';
import { syncKeywordIndexes } from './repositories/keywordRepository.js';
import { syncPersonIndexes } from './repositories/personRepository.js';
import { syncSmartAlbumIndexes } from './repositories/smartAlbumRepository.js';

await connectToMongo();

await syncMediaAssetIndexes();
await syncAlbumTreeNodeIndexes();
await syncPersonIndexes();
await syncKeywordIndexes();
await syncSmartAlbumIndexes();
await syncFaceDetectionIndexes();
await syncFaceMatchReviewIndexes();

const app = createServer();

const server = app.listen(config.port, () => {
  log.info(`Tedography API running on http://localhost:${config.port}`);
});

void server;
