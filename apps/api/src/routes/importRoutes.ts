import fs from 'node:fs/promises';
import { Router } from 'express';
import type {
  BrowseDirectoryResponse,
  RefreshFolderRequest,
  RefreshOperationResponse,
  GetStorageRootsResponse,
  ImportApiErrorResponse,
  RegisterImportRequest,
  RegisterImportResponse,
  ScanImportRequest,
  ScanImportResponse
} from '@tedography/domain';
import { browseDirectory, BrowseServiceError } from '../import/browseService.js';
import {
  rebuildDerivedFilesInFolder,
  RefreshServiceError,
  reimportKnownAssetsInFolder
} from '../import/refreshService.js';
import {
  verifyKnownAssetsInFolder,
  VerifyServiceError
} from '../import/verifyService.js';
import { registerImportedFiles, RegisterImportServiceError } from '../import/registerImportService.js';
import { scanImportTarget, ScanServiceError } from '../import/scanService.js';
import { resolveSafeAbsolutePath } from '../import/storagePathUtils.js';
import { getStorageRootById, getStorageRoots } from '../import/storageRoots.js';
import { log } from '../logger.js';

export const importRoutes: Router = Router();

importRoutes.get('/storage-roots', (_req, res) => {
  const response: GetStorageRootsResponse = {
    storageRoots: getStorageRoots().map((root) => ({
      id: root.id,
      label: root.label,
      isAvailable: root.isAvailable
    }))
  };

  res.json(response);
});

importRoutes.get('/browse', async (req, res) => {
  const rootId = req.query.rootId;
  const relativePath = req.query.relativePath;

  if (typeof rootId !== 'string' || rootId.trim().length === 0) {
    const errorResponse: ImportApiErrorResponse = { error: 'rootId query parameter is required' };
    res.status(400).json(errorResponse);
    return;
  }

  if (relativePath !== undefined && typeof relativePath !== 'string') {
    const errorResponse: ImportApiErrorResponse = { error: 'relativePath query parameter must be a string' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const browseInput =
      typeof relativePath === 'string' ? { rootId, relativePath } : { rootId };
    const response: BrowseDirectoryResponse = await browseDirectory(browseInput);

    res.json(response);
  } catch (error) {
    if (error instanceof BrowseServiceError) {
      const errorResponse: ImportApiErrorResponse = { error: error.message };

      if (error.code === 'INVALID_INPUT') {
        res.status(400).json(errorResponse);
        return;
      }

      if (error.code === 'NOT_FOUND') {
        res.status(404).json(errorResponse);
        return;
      }

      if (error.code === 'UNAVAILABLE') {
        res.status(409).json(errorResponse);
        return;
      }
    }

    log.error('Failed to browse import directory', error);
    const errorResponse: ImportApiErrorResponse = { error: 'Failed to browse directory' };
    res.status(500).json(errorResponse);
  }
});

importRoutes.post('/scan', async (req, res) => {
  const body = req.body as Partial<ScanImportRequest> | undefined;
  const rootId = body?.rootId;
  const relativePath = body?.relativePath;

  if (typeof rootId !== 'string' || rootId.trim().length === 0) {
    const errorResponse: ImportApiErrorResponse = { error: 'rootId is required' };
    res.status(400).json(errorResponse);
    return;
  }

  if (typeof relativePath !== 'string') {
    const errorResponse: ImportApiErrorResponse = { error: 'relativePath is required' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const response: ScanImportResponse = await scanImportTarget({
      rootId,
      relativePath
    });
    res.json(response);
  } catch (error) {
    if (error instanceof ScanServiceError) {
      const errorResponse: ImportApiErrorResponse = { error: error.message };

      if (error.code === 'INVALID_INPUT') {
        res.status(400).json(errorResponse);
        return;
      }

      if (error.code === 'NOT_FOUND') {
        res.status(404).json(errorResponse);
        return;
      }

      if (error.code === 'UNAVAILABLE') {
        res.status(409).json(errorResponse);
        return;
      }
    }

    log.error('Failed to scan import target', error);
    const errorResponse: ImportApiErrorResponse = { error: 'Failed to scan import target' };
    res.status(500).json(errorResponse);
  }
});

importRoutes.post('/register', async (req, res) => {
  const body = req.body as Partial<RegisterImportRequest> | undefined;
  const rootId = body?.rootId;
  const files = body?.files;

  if (typeof rootId !== 'string' || rootId.trim().length === 0) {
    const errorResponse: ImportApiErrorResponse = { error: 'rootId is required' };
    res.status(400).json(errorResponse);
    return;
  }

  if (!Array.isArray(files)) {
    const errorResponse: ImportApiErrorResponse = { error: 'files must be an array' };
    res.status(400).json(errorResponse);
    return;
  }

  for (const file of files) {
    if (
      !file ||
      typeof file !== 'object' ||
      typeof (file as { relativePath?: unknown }).relativePath !== 'string' ||
      (file as { relativePath: string }).relativePath.trim().length === 0
    ) {
      const errorResponse: ImportApiErrorResponse = {
        error: 'each file must include a non-empty relativePath'
      };
      res.status(400).json(errorResponse);
      return;
    }
  }

  try {
    const response: RegisterImportResponse = await registerImportedFiles({
      rootId,
      relativePaths: files.map((file) => (file as { relativePath: string }).relativePath)
    });
    res.json(response);
  } catch (error) {
    if (error instanceof RegisterImportServiceError) {
      const errorResponse: ImportApiErrorResponse = { error: error.message };

      if (error.code === 'INVALID_INPUT') {
        res.status(400).json(errorResponse);
        return;
      }

      if (error.code === 'NOT_FOUND') {
        res.status(404).json(errorResponse);
        return;
      }

      if (error.code === 'UNAVAILABLE') {
        res.status(409).json(errorResponse);
        return;
      }
    }

    log.error('Failed to register import files', error);
    const errorResponse: ImportApiErrorResponse = { error: 'Failed to register files' };
    res.status(500).json(errorResponse);
  }
});

function readRefreshFolderRequest(body: Partial<RefreshFolderRequest> | undefined): {
  rootId: string;
  relativePath: string;
} | null {
  if (typeof body?.rootId !== 'string' || typeof body?.relativePath !== 'string') {
    return null;
  }

  return {
    rootId: body.rootId,
    relativePath: body.relativePath
  };
}

importRoutes.post('/reimport-known', async (req, res) => {
  const request = readRefreshFolderRequest(req.body as Partial<RefreshFolderRequest> | undefined);
  if (!request) {
    const errorResponse: ImportApiErrorResponse = { error: 'rootId and relativePath are required' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const response: RefreshOperationResponse = await reimportKnownAssetsInFolder(request);
    res.json(response);
  } catch (error) {
    if (error instanceof RefreshServiceError) {
      const errorResponse: ImportApiErrorResponse = { error: error.message };
      res.status(error.code === 'INVALID_INPUT' ? 400 : error.code === 'NOT_FOUND' ? 404 : 409).json(errorResponse);
      return;
    }

    log.error('Failed to reimport known assets in folder', error);
    res.status(500).json({ error: 'Failed to reimport known assets in folder' });
  }
});

importRoutes.post('/verify-known', async (req, res) => {
  const request = readRefreshFolderRequest(req.body as Partial<RefreshFolderRequest> | undefined);
  if (!request) {
    const errorResponse: ImportApiErrorResponse = { error: 'rootId and relativePath are required' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const response = await verifyKnownAssetsInFolder(request);
    res.json(response);
  } catch (error) {
    if (error instanceof VerifyServiceError) {
      const errorResponse: ImportApiErrorResponse = { error: error.message };
      res.status(error.code === 'INVALID_INPUT' ? 400 : error.code === 'NOT_FOUND' ? 404 : 409).json(errorResponse);
      return;
    }

    log.error('Failed to verify known assets in folder', error);
    res.status(500).json({ error: 'Failed to verify known assets in folder' });
  }
});

importRoutes.post('/rebuild-derived', async (req, res) => {
  const request = readRefreshFolderRequest(req.body as Partial<RefreshFolderRequest> | undefined);
  if (!request) {
    const errorResponse: ImportApiErrorResponse = { error: 'rootId and relativePath are required' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    const response: RefreshOperationResponse = await rebuildDerivedFilesInFolder(request);
    res.json(response);
  } catch (error) {
    if (error instanceof RefreshServiceError) {
      const errorResponse: ImportApiErrorResponse = { error: error.message };
      res.status(error.code === 'INVALID_INPUT' ? 400 : error.code === 'NOT_FOUND' ? 404 : 409).json(errorResponse);
      return;
    }

    log.error('Failed to rebuild derived files in folder', error);
    res.status(500).json({ error: 'Failed to rebuild derived files in folder' });
  }
});

importRoutes.get('/media', async (req, res) => {
  const rootId = req.query.rootId;
  const relativePath = req.query.relativePath;

  if (typeof rootId !== 'string' || rootId.trim().length === 0) {
    const errorResponse: ImportApiErrorResponse = { error: 'rootId query parameter is required' };
    res.status(400).json(errorResponse);
    return;
  }

  if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
    const errorResponse: ImportApiErrorResponse = { error: 'relativePath query parameter is required' };
    res.status(400).json(errorResponse);
    return;
  }

  const root = getStorageRootById(rootId);
  if (!root) {
    const errorResponse: ImportApiErrorResponse = { error: `Storage root not found: ${rootId}` };
    res.status(404).json(errorResponse);
    return;
  }

  try {
    const absolutePath = resolveSafeAbsolutePath(root, relativePath);
    const targetStat = await fs.stat(absolutePath);
    if (!targetStat.isFile()) {
      const errorResponse: ImportApiErrorResponse = { error: 'File not found' };
      res.status(404).json(errorResponse);
      return;
    }

    res.sendFile(absolutePath);
  } catch (error) {
    if (error instanceof Error && error.message.includes('outside the storage root')) {
      const errorResponse: ImportApiErrorResponse = { error: error.message };
      res.status(400).json(errorResponse);
      return;
    }

    const errorResponse: ImportApiErrorResponse = { error: 'File not found' };
    res.status(404).json(errorResponse);
  }
});
