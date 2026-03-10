import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `[config] Missing required environment variable: ${name}`
    );
  }

  return value;
}

export const config = {
  mongoUri: requireEnv('MONGODB_URI'),
  importRoot: process.env.TEDOGRAPHY_IMPORT_ROOT,

  port: Number(process.env.PORT ?? 4000),
};
