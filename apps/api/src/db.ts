import mongoose from 'mongoose';

const defaultMongoUri = 'mongodb://127.0.0.1:27017/tedography';

export async function connectToMongo(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI ?? defaultMongoUri;
  await mongoose.connect(mongoUri);
  console.log(`[src] Connected to MongoDB at ${mongoUri}`);
}
