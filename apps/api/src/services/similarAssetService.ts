import { IMAGE_ANALYSIS_VERSION_V1, scoreCandidatePair } from '@tedography/duplicate-domain';
import { MediaType, type MediaAsset, type PhotoState } from '@tedography/domain';
import type {
  DuplicateCandidatePairAssetSummary,
  FindSimilarAssetsResponse,
  SimilarAssetMatch
} from '@tedography/shared';
import { findById, findPhotoAssets } from '../repositories/assetRepository.js';
import { findImageAnalysisByAssetIdAndVersion } from '../repositories/imageAnalysisRepository.js';

function toAssetSummary(asset: MediaAsset): DuplicateCandidatePairAssetSummary {
  return {
    id: asset.id,
    filename: asset.filename,
    mediaType: asset.mediaType,
    originalArchivePath:
      typeof asset.originalArchivePath === 'string' && asset.originalArchivePath.length > 0
        ? asset.originalArchivePath
        : typeof asset.archivePath === 'string' && asset.archivePath.length > 0
          ? asset.archivePath
          : null,
    ...(asset.albumIds !== undefined ? { albumIds: asset.albumIds } : {}),
    ...(asset.captureDateTime !== undefined ? { captureDateTime: asset.captureDateTime } : {}),
    ...(asset.width !== undefined ? { width: asset.width } : {}),
    ...(asset.height !== undefined ? { height: asset.height } : {}),
    ...(asset.photoState !== undefined ? { photoState: asset.photoState } : {}),
    ...(asset.originalFileFormat ? { originalFileFormat: asset.originalFileFormat } : {}),
    ...(asset.originalFileSizeBytes !== undefined
      ? { originalFileSizeBytes: asset.originalFileSizeBytes }
      : {}),
    ...(asset.displayStorageType !== undefined ? { displayStorageType: asset.displayStorageType } : {})
  };
}

function bitLengthForHex(hash: string | undefined): number | undefined {
  return hash ? hash.length * 4 : undefined;
}

function hammingDistance(left: string, right: string): number {
  const normalizedLeft = left.trim().toLowerCase();
  const normalizedRight = right.trim().toLowerCase();

  if (normalizedLeft.length !== normalizedRight.length) {
    throw new Error('Hash inputs must have equal length.');
  }

  let distance = 0;
  for (let index = 0; index < normalizedLeft.length; index += 1) {
    const leftNibble = Number.parseInt(normalizedLeft[index] ?? '', 16);
    const rightNibble = Number.parseInt(normalizedRight[index] ?? '', 16);
    if (!Number.isFinite(leftNibble) || !Number.isFinite(rightNibble)) {
      throw new Error('Hash inputs must be hexadecimal.');
    }

    let xor = leftNibble ^ rightNibble;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

function buildSimilarMatch(input: {
  sourceAsset: MediaAsset;
  sourceAnalysis: {
    width?: number;
    height?: number;
    dHash?: string;
    pHash?: string;
    sourceUpdatedAt?: Date;
  };
  candidateAsset: MediaAsset;
  candidateAnalysis: {
    width?: number;
    height?: number;
    dHash?: string;
    pHash?: string;
    sourceUpdatedAt?: Date;
  };
}): SimilarAssetMatch | null {
  let dHashDistance: number | undefined;
  let pHashDistance: number | undefined;

  if (input.sourceAnalysis.dHash && input.candidateAnalysis.dHash) {
    dHashDistance = hammingDistance(input.sourceAnalysis.dHash, input.candidateAnalysis.dHash);
  }

  if (input.sourceAnalysis.pHash && input.candidateAnalysis.pHash) {
    pHashDistance = hammingDistance(input.sourceAnalysis.pHash, input.candidateAnalysis.pHash);
  }

  const scoringInput: Parameters<typeof scoreCandidatePair>[0] = {};
  if (dHashDistance !== undefined) {
    scoringInput.dHashDistance = dHashDistance;
  }
  const dHashBitLength = bitLengthForHex(input.sourceAnalysis.dHash);
  if (dHashBitLength !== undefined) {
    scoringInput.dHashBitLength = dHashBitLength;
  }
  if (pHashDistance !== undefined) {
    scoringInput.pHashDistance = pHashDistance;
  }
  const pHashBitLength = bitLengthForHex(input.sourceAnalysis.pHash);
  if (pHashBitLength !== undefined) {
    scoringInput.pHashBitLength = pHashBitLength;
  }
  if (input.sourceAnalysis.width !== undefined) {
    scoringInput.width = input.sourceAnalysis.width;
  }
  if (input.sourceAnalysis.height !== undefined) {
    scoringInput.height = input.sourceAnalysis.height;
  }
  if (input.candidateAnalysis.width !== undefined) {
    scoringInput.otherWidth = input.candidateAnalysis.width;
  }
  if (input.candidateAnalysis.height !== undefined) {
    scoringInput.otherHeight = input.candidateAnalysis.height;
  }
  if (input.sourceAnalysis.sourceUpdatedAt && input.candidateAnalysis.sourceUpdatedAt) {
    scoringInput.sourceUpdatedTimeDeltaMs = Math.abs(
      input.sourceAnalysis.sourceUpdatedAt.getTime() - input.candidateAnalysis.sourceUpdatedAt.getTime()
    );
  }

  const scored = scoreCandidatePair(scoringInput);
  if (!scored) {
    return null;
  }

  return {
    asset: toAssetSummary(input.candidateAsset),
    score: scored.score,
    classification: scored.classification,
    signals: scored.signals
  };
}

export async function findSimilarAssets(input: {
  assetId: string;
  limit?: number;
  photoState?: PhotoState;
}): Promise<FindSimilarAssetsResponse | null> {
  const sourceAsset = await findById(input.assetId);
  if (!sourceAsset || sourceAsset.mediaType !== MediaType.Photo) {
    return null;
  }

  const sourceAnalysis = await findImageAnalysisByAssetIdAndVersion(sourceAsset.id, IMAGE_ANALYSIS_VERSION_V1);
  if (!sourceAnalysis || sourceAnalysis.normalizedFingerprintStatus !== 'ready') {
    return {
      sourceAsset: toAssetSummary(sourceAsset),
      ...(input.photoState ? { photoStateFilter: input.photoState } : {}),
      analysisVersion: IMAGE_ANALYSIS_VERSION_V1,
      items: [],
      totalCandidatesConsidered: 0
    };
  }

  const normalizedLimit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 12)));
  const candidateAssets = (await findPhotoAssets()).filter(
    (asset) =>
      asset.id !== sourceAsset.id &&
      (input.photoState === undefined || asset.photoState === input.photoState)
  );

  const matches: SimilarAssetMatch[] = [];
  for (const candidateAsset of candidateAssets) {
    const candidateAnalysis = await findImageAnalysisByAssetIdAndVersion(
      candidateAsset.id,
      IMAGE_ANALYSIS_VERSION_V1
    );
    if (!candidateAnalysis || candidateAnalysis.normalizedFingerprintStatus !== 'ready') {
      continue;
    }

    const match = buildSimilarMatch({
      sourceAsset,
      sourceAnalysis,
      candidateAsset,
      candidateAnalysis
    });
    if (match) {
      matches.push(match);
    }
  }

  matches.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }

    const leftPath = left.asset.originalArchivePath ?? left.asset.filename;
    const rightPath = right.asset.originalArchivePath ?? right.asset.filename;
    return leftPath.localeCompare(rightPath);
  });

  return {
    sourceAsset: toAssetSummary(sourceAsset),
    ...(input.photoState ? { photoStateFilter: input.photoState } : {}),
    analysisVersion: IMAGE_ANALYSIS_VERSION_V1,
    items: matches.slice(0, normalizedLimit),
    totalCandidatesConsidered: candidateAssets.length
  };
}
