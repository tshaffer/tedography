import { Router, type Router as RouterType } from 'express';
import { requireFeature } from '../middleware/requireFeature.js';
import { config } from '../config.js';
import { log } from '../logger.js';
import { findByIds } from '../repositories/assetRepository.js';
import {
  resolveDisplayAbsolutePathForAsset,
  resolveOriginalAbsolutePathForAsset,
} from '../media/resolveAssetMediaPath.js';
import {
  batchAddToAlbum,
  buildAuthUrl,
  createAlbum,
  disconnect,
  exchangeCode,
  getAlbumUrl,
  getConnectionStatus,
  isNativelyUploadable,
  mimeTypeForFormat,
  uploadMedia,
} from '../services/googlePhotosService.js';

export const googlePhotosRoutes: RouterType = Router();

googlePhotosRoutes.get('/status', async (_req, res) => {
  try {
    const status = await getConnectionStatus();
    const configured = Boolean(config.googlePhotos.clientId && config.googlePhotos.clientSecret);
    if (status.connected) {
      res.json({ connected: true, configured, email: status.email });
    } else {
      res.json({ connected: false, configured, email: null });
    }
  } catch (error) {
    log.error('Failed to get Google Photos status', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

googlePhotosRoutes.get('/auth-url', (_req, res) => {
  try {
    const authUrl = buildAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
});

googlePhotosRoutes.get('/callback', async (req, res) => {
  const code = req.query['code'] as string | undefined;
  if (!code) {
    res.status(400).send('Missing authorization code');
    return;
  }
  try {
    await exchangeCode(code);
    res.redirect('http://localhost:3000/?gpconnected=1');
  } catch (error) {
    log.error('Google Photos OAuth callback error', error);
    const message = error instanceof Error ? error.message : String(error);
    res.redirect(`http://localhost:3000/?gperror=${encodeURIComponent(message)}`);
  }
});

googlePhotosRoutes.delete('/disconnect', requireFeature('maintenance'), async (_req, res) => {
  try {
    await disconnect();
    res.json({ ok: true });
  } catch (error) {
    log.error('Failed to disconnect Google Photos', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

export interface PublishRequest {
  assetIds: string[];
  albumTitle: string;
  uploadVersion: 'original' | 'display';
}

googlePhotosRoutes.post('/publish', requireFeature('import'), async (req, res) => {
  const body = req.body as Partial<PublishRequest>;

  if (!Array.isArray(body.assetIds) || body.assetIds.length === 0) {
    res.status(400).json({ error: 'assetIds must be a non-empty array' });
    return;
  }
  if (!body.albumTitle || body.albumTitle.trim().length === 0) {
    res.status(400).json({ error: 'albumTitle is required' });
    return;
  }
  const uploadVersion = body.uploadVersion ?? 'original';

  if (!(await getConnectionStatus()).connected) {
    res.status(401).json({ error: 'Not connected to Google Photos. Connect first.' });
    return;
  }

  try {
    const assets = await findByIds(body.assetIds);
    const assetMap = new Map(assets.map((a) => [a.id, a]));

    const uploadTokens: Array<{ token: string; filename: string }> = [];
    const uploadErrors: Array<{ filename: string; error: string }> = [];

    for (const assetId of body.assetIds) {
      const asset = assetMap.get(assetId);
      if (!asset) {
        uploadErrors.push({ filename: assetId, error: 'Asset not found' });
        continue;
      }

      const useOriginal =
        uploadVersion === 'original' &&
        typeof asset.originalFileFormat === 'string' &&
        isNativelyUploadable(asset.originalFileFormat);

      let filePath: string;
      let mimeType: string;

      try {
        if (useOriginal) {
          filePath = resolveOriginalAbsolutePathForAsset(asset);
          mimeType = mimeTypeForFormat(asset.originalFileFormat ?? 'jpg');
        } else {
          filePath = resolveDisplayAbsolutePathForAsset(asset);
          mimeType = 'image/jpeg';
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        uploadErrors.push({ filename: asset.filename, error: `Path resolution failed: ${msg}` });
        continue;
      }

      try {
        log.info(`Uploading ${asset.filename} to Google Photos`);
        const token = await uploadMedia(filePath, mimeType, asset.filename);
        uploadTokens.push({ token, filename: asset.filename });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        uploadErrors.push({ filename: asset.filename, error: msg });
      }
    }

    if (uploadTokens.length === 0) {
      res.json({
        albumId: null,
        albumTitle: body.albumTitle,
        albumUrl: null,
        uploadedCount: 0,
        errorCount: uploadErrors.length,
        errors: uploadErrors,
      });
      return;
    }

    const albumId = await createAlbum(body.albumTitle.trim());
    const { uploadedCount, errors: batchErrors } = await batchAddToAlbum(albumId, uploadTokens);
    const albumUrl = await getAlbumUrl(albumId);

    res.json({
      albumId,
      albumTitle: body.albumTitle,
      albumUrl,
      uploadedCount,
      errorCount: uploadErrors.length + batchErrors.length,
      errors: [...uploadErrors, ...batchErrors],
    });
  } catch (error) {
    log.error('Failed to publish to Google Photos', error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Publish failed: ${message}` });
  }
});
