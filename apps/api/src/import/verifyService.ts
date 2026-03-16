import fs from 'node:fs/promises';
import type {
  MediaAsset,
  RefreshFolderRequest,
  VerifyKnownAssetsInFolderResponse,
  VerifyKnownAssetsInFolderResultDto,
  VerifyKnownAssetsInFolderSummaryDto,
  VerifyProblemCategory
} from '@tedography/domain';
import {
  resolveDisplayAbsolutePathForAsset,
  resolveOriginalAbsolutePathForAsset,
  resolveThumbnailAbsolutePathForAsset
} from '../media/resolveAssetMediaPath.js';
import { findByOriginalStorageRootId } from '../repositories/assetRepository.js';
import { getStorageRootById, getStorageRoots } from './storageRoots.js';
import { normalizeRelativePath, resolveSafeAbsolutePath } from './storagePathUtils.js';

export type VerifyServiceErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'UNAVAILABLE';

export class VerifyServiceError extends Error {
  public readonly code: VerifyServiceErrorCode;

  constructor(code: VerifyServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function isDirectChildOfFolder(assetArchivePath: string, folderRelativePath: string): boolean {
  const normalizedFolderPath = normalizeRelativePath(folderRelativePath);
  if (normalizedFolderPath.length === 0) {
    return !assetArchivePath.includes('/');
  }

  if (!assetArchivePath.startsWith(`${normalizedFolderPath}/`)) {
    return false;
  }

  const remainder = assetArchivePath.slice(normalizedFolderPath.length + 1);
  return remainder.length > 0 && !remainder.includes('/');
}

async function validateFolderRequest(input: RefreshFolderRequest): Promise<{
  rootId: string;
  rootLabel: string;
  scanTargetRelativePath: string;
}> {
  const rootId = input.rootId.trim();
  if (rootId.length === 0) {
    throw new VerifyServiceError('INVALID_INPUT', 'rootId is required');
  }

  const root = getStorageRootById(rootId);
  if (!root) {
    throw new VerifyServiceError('NOT_FOUND', `Storage root not found: ${rootId}`);
  }

  const rootWithAvailability = getStorageRoots().find((storageRoot) => storageRoot.id === root.id);
  if (!rootWithAvailability?.isAvailable) {
    throw new VerifyServiceError('UNAVAILABLE', `Storage root is unavailable: ${root.id}`);
  }

  let scanTargetRelativePath: string;
  let absoluteTargetPath: string;
  try {
    scanTargetRelativePath = normalizeRelativePath(input.relativePath);
    absoluteTargetPath = resolveSafeAbsolutePath(root, scanTargetRelativePath);
  } catch (error) {
    throw new VerifyServiceError(
      'INVALID_INPUT',
      error instanceof Error ? error.message : 'Invalid relativePath'
    );
  }

  try {
    const stat = await fs.stat(absoluteTargetPath);
    if (!stat.isDirectory()) {
      throw new VerifyServiceError('NOT_FOUND', 'Folder not found');
    }
  } catch (error) {
    if (error instanceof VerifyServiceError) {
      throw error;
    }
    throw new VerifyServiceError('NOT_FOUND', 'Folder not found');
  }

  return {
    rootId: root.id,
    rootLabel: root.label,
    scanTargetRelativePath
  };
}

function createEmptySummary(): VerifyKnownAssetsInFolderSummaryDto {
  return {
    totalKnownAssetsChecked: 0,
    healthyAssets: 0,
    assetsWithProblems: 0,
    missingThumbnailCount: 0,
    missingDisplayCount: 0,
    sourceMissingCount: 0,
    invalidReferenceCount: 0,
    missingStorageRootCount: 0,
    fileSizeMismatchCount: 0,
    otherProblemCount: 0
  };
}

async function statFile(absolutePath: string): Promise<{ isFile: boolean; size: number } | null> {
  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      return null;
    }
    return { isFile: true, size: stat.size };
  } catch {
    return null;
  }
}

function addProblem(
  categories: Set<VerifyProblemCategory>,
  messages: string[],
  category: VerifyProblemCategory,
  message: string
): void {
  categories.add(category);
  messages.push(message);
}

function applyCategoryCounts(
  summary: VerifyKnownAssetsInFolderSummaryDto,
  categories: Set<VerifyProblemCategory>
): void {
  for (const category of categories) {
    switch (category) {
      case 'MissingOriginalFile':
        summary.sourceMissingCount += 1;
        break;
      case 'MissingDisplayFile':
        summary.missingDisplayCount += 1;
        break;
      case 'MissingThumbnailFile':
        summary.missingThumbnailCount += 1;
        break;
      case 'InvalidOriginalReference':
      case 'InvalidDisplayReference':
      case 'InvalidThumbnailReference':
        summary.invalidReferenceCount += 1;
        break;
      case 'MissingStorageRoot':
        summary.missingStorageRootCount += 1;
        break;
      case 'FileSizeMismatch':
        summary.fileSizeMismatchCount += 1;
        break;
      case 'Other':
        summary.otherProblemCount += 1;
        break;
    }
  }
}

async function verifyAsset(asset: MediaAsset): Promise<VerifyKnownAssetsInFolderResultDto> {
  const categories = new Set<VerifyProblemCategory>();
  const messages: string[] = [];

  try {
    const originalAbsolutePath = resolveOriginalAbsolutePathForAsset(asset);
    const originalStat = await statFile(originalAbsolutePath);
    if (!originalStat) {
      addProblem(categories, messages, 'MissingOriginalFile', 'Source file not found');
    } else if (
      typeof asset.originalFileSizeBytes === 'number' &&
      asset.originalFileSizeBytes >= 0 &&
      originalStat.size !== asset.originalFileSizeBytes
    ) {
      addProblem(
        categories,
        messages,
        'FileSizeMismatch',
        `Source size mismatch: db=${asset.originalFileSizeBytes} disk=${originalStat.size}`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid source reference';
    if (message.includes('Storage root not found')) {
      addProblem(categories, messages, 'MissingStorageRoot', message);
    } else {
      addProblem(categories, messages, 'InvalidOriginalReference', message);
    }
  }

  try {
    const displayAbsolutePath = resolveDisplayAbsolutePathForAsset(asset);
    const displayStat = await statFile(displayAbsolutePath);
    if (!displayStat) {
      addProblem(categories, messages, 'MissingDisplayFile', 'Display file not found');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid display reference';
    if (message.includes('Storage root not found')) {
      addProblem(categories, messages, 'MissingStorageRoot', message);
    } else {
      addProblem(categories, messages, 'InvalidDisplayReference', message);
    }
  }

  try {
    const thumbnailAbsolutePath = resolveThumbnailAbsolutePathForAsset(asset);
    if (asset.mediaType === 'Photo') {
      if (!thumbnailAbsolutePath) {
        addProblem(categories, messages, 'InvalidThumbnailReference', 'Thumbnail reference is missing');
      } else {
        const thumbnailStat = await statFile(thumbnailAbsolutePath);
        if (!thumbnailStat) {
          addProblem(categories, messages, 'MissingThumbnailFile', 'Thumbnail file not found');
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid thumbnail reference';
    addProblem(categories, messages, 'InvalidThumbnailReference', message);
  }

  if (categories.size === 0) {
    return {
      assetId: asset.id,
      filename: asset.filename,
      relativePath: asset.originalArchivePath,
      status: 'Healthy',
      problemCategories: []
    };
  }

  return {
    assetId: asset.id,
    filename: asset.filename,
    relativePath: asset.originalArchivePath,
    status: 'ProblemsFound',
    problemCategories: Array.from(categories),
    message: messages.join(' | ')
  };
}

export async function verifyKnownAssetsInFolder(
  input: RefreshFolderRequest
): Promise<VerifyKnownAssetsInFolderResponse> {
  const folder = await validateFolderRequest(input);
  const knownAssets = (await findByOriginalStorageRootId(folder.rootId)).filter((asset) =>
    isDirectChildOfFolder(asset.originalArchivePath, folder.scanTargetRelativePath)
  );

  const summary = createEmptySummary();
  const results: VerifyKnownAssetsInFolderResultDto[] = [];

  for (const asset of knownAssets) {
    summary.totalKnownAssetsChecked += 1;
    const result = await verifyAsset(asset);
    results.push(result);

    if (result.status === 'Healthy') {
      summary.healthyAssets += 1;
    } else {
      summary.assetsWithProblems += 1;
      applyCategoryCounts(summary, new Set(result.problemCategories));
    }
  }

  return {
    operation: 'VerifyKnownAssetsInFolder',
    root: {
      id: folder.rootId,
      label: folder.rootLabel
    },
    scanTargetRelativePath: folder.scanTargetRelativePath,
    summary,
    results
  };
}
