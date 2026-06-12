import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyExtractedCaptureDate,
  classifyStoredCaptureDate
} from '../import/captureProvenance.js';
import { extractCaptureDateFieldsFromTags } from '../import/exifMetadata.js';

test('DateTimeOriginal classifies as exif-original regardless of camera tags', () => {
  assert.equal(
    classifyExtractedCaptureDate({
      captureDateTimeTag: 'DateTimeOriginal',
      cameraMake: null,
      cameraModel: null
    }),
    'exif-original'
  );
  assert.equal(
    classifyExtractedCaptureDate({
      captureDateTimeTag: 'SubSecDateTimeOriginal',
      cameraMake: null,
      cameraModel: null
    }),
    'exif-original'
  );
});

test('CreateDate family is exif-original only with camera tags', () => {
  assert.equal(
    classifyExtractedCaptureDate({
      captureDateTimeTag: 'CreateDate',
      cameraMake: 'NIKON CORPORATION',
      cameraModel: 'NIKON D7500'
    }),
    'exif-original'
  );
  assert.equal(
    classifyExtractedCaptureDate({
      captureDateTimeTag: 'CreateDate',
      cameraMake: null,
      cameraModel: null
    }),
    'exif-weak'
  );
  assert.equal(
    classifyExtractedCaptureDate({
      captureDateTimeTag: 'TrackCreateDate',
      cameraMake: null,
      cameraModel: 'iPhone 12'
    }),
    'exif-original'
  );
});

test('ModifyDate is always exif-weak, even with camera tags', () => {
  assert.equal(
    classifyExtractedCaptureDate({
      captureDateTimeTag: 'ModifyDate',
      cameraMake: 'Canon',
      cameraModel: 'Canon EOS 5D'
    }),
    'exif-weak'
  );
});

test('no date tag classifies as none', () => {
  assert.equal(
    classifyExtractedCaptureDate({
      captureDateTimeTag: null,
      cameraMake: 'Canon',
      cameraModel: null
    }),
    'none'
  );
});

test('classifyStoredCaptureDate: matching dates classify by tag table', () => {
  const fileDate = new Date('1998-06-01T12:34:56.000Z');
  assert.equal(
    classifyStoredCaptureDate({
      storedCaptureDateTime: new Date(fileDate),
      fileFields: {
        captureDateTime: fileDate,
        captureDateTimeTag: 'DateTimeOriginal',
        cameraMake: 'Nikon',
        cameraModel: 'D70'
      }
    }),
    'exif-original'
  );
});

test('classifyStoredCaptureDate: mismatched dates are changed-after-import', () => {
  assert.equal(
    classifyStoredCaptureDate({
      storedCaptureDateTime: new Date('1998-08-15T07:00:00.000Z'),
      fileFields: {
        captureDateTime: new Date('2004-02-11T19:22:01.000Z'),
        captureDateTimeTag: 'ModifyDate',
        cameraMake: null,
        cameraModel: null
      }
    }),
    'changed-after-import'
  );
});

test('classifyStoredCaptureDate: stored date with no file date is changed-after-import', () => {
  assert.equal(
    classifyStoredCaptureDate({
      storedCaptureDateTime: new Date('1998-08-15T07:00:00.000Z'),
      fileFields: {
        captureDateTime: null,
        captureDateTimeTag: null,
        cameraMake: null,
        cameraModel: null
      }
    }),
    'changed-after-import'
  );
});

test('classifyStoredCaptureDate: cleared stored date with a file date is changed-after-import', () => {
  assert.equal(
    classifyStoredCaptureDate({
      storedCaptureDateTime: null,
      fileFields: {
        captureDateTime: new Date('2004-02-11T19:22:01.000Z'),
        captureDateTimeTag: 'DateTimeOriginal',
        cameraMake: 'Nikon',
        cameraModel: 'D70'
      }
    }),
    'changed-after-import'
  );
});

test('classifyStoredCaptureDate: no dates anywhere is none', () => {
  assert.equal(
    classifyStoredCaptureDate({
      storedCaptureDateTime: null,
      fileFields: {
        captureDateTime: null,
        captureDateTimeTag: null,
        cameraMake: 'Epson',
        cameraModel: null
      }
    }),
    'none'
  );
});

test('extractCaptureDateFieldsFromTags reports the winning tag in fallback order', () => {
  const fields = extractCaptureDateFieldsFromTags({
    ModifyDate: '2026-01-05T10:00:00.000Z',
    CreateDate: '1998-06-01T12:34:56.000Z',
    Make: ' NIKON CORPORATION ',
    Model: 'NIKON D7500'
  });

  assert.equal(fields.captureDateTimeTag, 'CreateDate');
  assert.equal(fields.captureDateTime?.toISOString(), '1998-06-01T12:34:56.000Z');
  assert.equal(fields.cameraMake, 'NIKON CORPORATION');
  assert.equal(fields.cameraModel, 'NIKON D7500');
});

test('extractCaptureDateFieldsFromTags returns nulls when no date tags exist', () => {
  const fields = extractCaptureDateFieldsFromTags({ Make: 'Canon' });
  assert.equal(fields.captureDateTime, null);
  assert.equal(fields.captureDateTimeTag, null);
});
