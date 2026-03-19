import { createServer } from './server.js';
import { connectToMongo } from './db.js';
import { config } from './config.js';
import { log } from './logger.js';
import { syncMediaAssetIndexes } from './repositories/assetRepository.js';
import { syncAlbumTreeNodeIndexes } from './repositories/albumTreeRepository.js';
import { syncDuplicateCandidatePairIndexes } from './repositories/duplicateCandidatePairRepository.js';
import { syncDuplicateGroupResolutionIndexes } from './repositories/duplicateGroupResolutionRepository.js';
import { syncDuplicateActionPlanIndexes } from './repositories/duplicateActionPlanRepository.js';
import { syncDuplicateActionExecutionIndexes } from './repositories/duplicateActionExecutionRepository.js';
import { syncDuplicateReconciliationIndexes } from './repositories/duplicateReconciliationRepository.js';

await connectToMongo();

await syncMediaAssetIndexes();
await syncAlbumTreeNodeIndexes();
await syncDuplicateCandidatePairIndexes();
await syncDuplicateGroupResolutionIndexes();
await syncDuplicateActionPlanIndexes();
await syncDuplicateActionExecutionIndexes();
await syncDuplicateReconciliationIndexes();

const app = createServer();

const server = app.listen(config.port, () => {
  log.info(`Tedography API running on http://localhost:${config.port}`);
});

void server;
