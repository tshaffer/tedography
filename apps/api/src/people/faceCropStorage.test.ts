import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOrientedImageDimensions } from './faceCropStorage.js';

test('resolveOrientedImageDimensions keeps width and height for normal orientation', () => {
  assert.deepEqual(
    resolveOrientedImageDimensions({
      metadataWidth: 4032,
      metadataHeight: 3024,
      metadataOrientation: 1
    }),
    { width: 4032, height: 3024 }
  );
});

test('resolveOrientedImageDimensions swaps width and height for 90-degree EXIF orientation', () => {
  assert.deepEqual(
    resolveOrientedImageDimensions({
      metadataWidth: 4032,
      metadataHeight: 3024,
      metadataOrientation: 6
    }),
    { width: 3024, height: 4032 }
  );
});

test('resolveOrientedImageDimensions falls back to asset dimensions when metadata is unavailable', () => {
  assert.deepEqual(
    resolveOrientedImageDimensions({
      assetWidth: 3000,
      assetHeight: 4000
    }),
    { width: 3000, height: 4000 }
  );
});
