import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { log } from '../logger.js';

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PHOTOS_UPLOAD_URL = 'https://photoslibrary.googleapis.com/v1/uploads';
const PHOTOS_API_BASE = 'https://photoslibrary.googleapis.com/v1';
const SCOPE = 'openid email https://www.googleapis.com/auth/photoslibrary.appendonly';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email?: string | undefined;
}

const PHOTO_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
};

export function isNativelyUploadable(fileFormat: string): boolean {
  return fileFormat.toLowerCase() in PHOTO_MIME_TYPES;
}

export function mimeTypeForFormat(fileFormat: string): string {
  return PHOTO_MIME_TYPES[fileFormat.toLowerCase()] ?? 'image/jpeg';
}

export function buildAuthUrl(): string {
  const { clientId, redirectUri } = config.googlePhotos;
  if (!clientId) throw new Error('GOOGLE_PHOTOS_CLIENT_ID is not configured');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const raw = await fs.readFile(config.googlePhotos.tokenPath, 'utf-8');
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await fs.mkdir(path.dirname(config.googlePhotos.tokenPath), { recursive: true });
  await fs.writeFile(config.googlePhotos.tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
}

function extractEmailFromIdToken(idToken: string): string | undefined {
  try {
    const payload = idToken.split('.')[1];
    if (!payload) return undefined;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as Record<string, unknown>;
    return typeof decoded['email'] === 'string' ? decoded['email'] : undefined;
  } catch {
    return undefined;
  }
}

export async function getConnectionStatus(): Promise<{ connected: false } | { connected: true; email: string | null }> {
  const tokens = await loadTokens();
  if (!tokens) return { connected: false };
  return { connected: true, email: tokens.email ?? null };
}

export async function disconnect(): Promise<void> {
  try {
    await fs.unlink(config.googlePhotos.tokenPath);
  } catch {
    // already gone
  }
}

export async function exchangeCode(code: string): Promise<void> {
  const { clientId, clientSecret, redirectUri } = config.googlePhotos;
  if (!clientId || !clientSecret) throw new Error('Google Photos credentials not configured');

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in: number;
  };

  const email = data.id_token ? extractEmailFromIdToken(data.id_token) : undefined;
  const existing = await loadTokens();
  await saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? existing?.refreshToken ?? '',
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    email: email ?? existing?.email,
  });
}

async function refreshAccessToken(tokens: StoredTokens): Promise<StoredTokens> {
  const { clientId, clientSecret } = config.googlePhotos;
  if (!clientId || !clientSecret) throw new Error('Google Photos credentials not configured');

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokens.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  const updated: StoredTokens = {
    ...tokens,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  await saveTokens(updated);
  return updated;
}

async function getValidAccessToken(): Promise<string> {
  let tokens = await loadTokens();
  if (!tokens) throw new Error('Not connected to Google Photos');

  if (Date.now() >= tokens.expiresAt) {
    log.info('Refreshing Google Photos access token');
    tokens = await refreshAccessToken(tokens);
  }

  return tokens.accessToken;
}

export async function uploadMedia(filePath: string, mimeType: string, filename: string): Promise<string> {
  const accessToken = await getValidAccessToken();
  const fileData = await fs.readFile(filePath);

  const res = await fetch(PHOTOS_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'X-Goog-Upload-Content-Type': mimeType,
      'X-Goog-Upload-Protocol': 'raw',
      'X-Goog-Upload-File-Name': filename,
    },
    body: fileData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed for "${filename}": ${res.status} ${text}`);
  }

  return res.text();
}

export async function createAlbum(title: string): Promise<string> {
  const accessToken = await getValidAccessToken();

  const res = await fetch(`${PHOTOS_API_BASE}/albums`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ album: { title } }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Album creation failed: ${res.status} ${text}`);
  }

  const data = await res.json() as { id: string; productUrl?: string };
  return data.id;
}

export async function getAlbumUrl(albumId: string): Promise<string | null> {
  const accessToken = await getValidAccessToken();

  try {
    const res = await fetch(`${PHOTOS_API_BASE}/albums/${albumId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { productUrl?: string };
    return data.productUrl ?? null;
  } catch {
    return null;
  }
}

export interface BatchCreateResult {
  uploadedCount: number;
  errors: Array<{ filename: string; error: string }>;
}

export async function batchAddToAlbum(albumId: string, uploadTokens: Array<{ token: string; filename: string }>): Promise<BatchCreateResult> {
  const accessToken = await getValidAccessToken();
  const BATCH_SIZE = 50;
  let uploadedCount = 0;
  const errors: Array<{ filename: string; error: string }> = [];

  for (let i = 0; i < uploadTokens.length; i += BATCH_SIZE) {
    const batch = uploadTokens.slice(i, i + BATCH_SIZE);
    const newMediaItems = batch.map(({ token, filename }) => ({
      description: filename,
      simpleMediaItem: { uploadToken: token, fileName: filename },
    }));

    const res = await fetch(`${PHOTOS_API_BASE}/mediaItems:batchCreate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ albumId, newMediaItems }),
    });

    if (!res.ok) {
      const text = await res.text();
      for (const item of batch) {
        errors.push({ filename: item.filename, error: `Batch create failed: ${res.status} ${text}` });
      }
      continue;
    }

    const data = await res.json() as {
      newMediaItemResults: Array<{ status: { code?: number; message?: string }; mediaItem?: { id: string } }>;
    };

    for (let j = 0; j < data.newMediaItemResults.length; j++) {
      const result = data.newMediaItemResults[j];
      const item = batch[j];
      if (result && item) {
        if (result.status.code !== undefined && result.status.code !== 0) {
          errors.push({ filename: item.filename, error: result.status.message ?? 'Unknown error' });
        } else {
          uploadedCount++;
        }
      }
    }
  }

  return { uploadedCount, errors };
}
