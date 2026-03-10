import mongoose from 'mongoose';
import { config } from './config.js';
import { log } from './logger.js';

export async function connectToMongo(): Promise<void> {
  await mongoose.connect(config.mongoUri);

  log.info('Connected to MongoDB');
}
