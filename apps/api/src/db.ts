import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectToMongo(): Promise<void> {
  await mongoose.connect(config.mongoUri);

  console.log('[src] Connected to MongoDB');
}
