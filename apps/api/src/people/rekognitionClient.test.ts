import assert from 'node:assert/strict';
import test from 'node:test';
import { isRekognitionImageBytesTooLargeError } from './rekognitionClient.js';

test('detects Rekognition oversized image validation errors', () => {
  assert.equal(
    isRekognitionImageBytesTooLargeError({
      name: 'InvalidParameterException',
      message:
        "1 validation error detected: Value at 'image.bytes' failed to satisfy constraint: Member must have length less than or equal to 5242880"
    }),
    true
  );
});

test('ignores unrelated Rekognition errors', () => {
  assert.equal(
    isRekognitionImageBytesTooLargeError({
      name: 'InvalidParameterException',
      message: 'Some other validation problem'
    }),
    false
  );
  assert.equal(
    isRekognitionImageBytesTooLargeError({
      name: 'AccessDeniedException',
      message:
        "1 validation error detected: Value at 'image.bytes' failed to satisfy constraint: Member must have length less than or equal to 5242880"
    }),
    false
  );
});
