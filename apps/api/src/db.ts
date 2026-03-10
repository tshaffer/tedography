import mongoose from 'mongoose';

export async function connectToMongo(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error(
      'MONGODB_URI environment variable is not set. Please configure it in apps/api/.env'
    );
  }

  await mongoose.connect(mongoUri);

  console.log(`[src] Connected to MongoDB`);
}
