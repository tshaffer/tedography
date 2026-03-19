export interface CanonicalAssetPair {
  assetIdA: string;
  assetIdB: string;
}

export function canonicalizeAssetPair(assetIdLeft: string, assetIdRight: string): CanonicalAssetPair {
  if (assetIdLeft === assetIdRight) {
    throw new Error('Candidate pair requires two distinct asset ids.');
  }

  return assetIdLeft < assetIdRight
    ? { assetIdA: assetIdLeft, assetIdB: assetIdRight }
    : { assetIdA: assetIdRight, assetIdB: assetIdLeft };
}
