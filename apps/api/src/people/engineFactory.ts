import { config } from '../config.js';
import { MockRecognitionEngine } from './mockRecognitionEngine.js';
import { NoopRecognitionEngine } from './noopRecognitionEngine.js';
import type { PeopleRecognitionEngine } from './recognitionEngine.js';
import { RekognitionRecognitionEngine } from './rekognitionRecognitionEngine.js';

const mockEngine = new MockRecognitionEngine();
const noopEngine = new NoopRecognitionEngine();
const rekognitionEngine = new RekognitionRecognitionEngine();

export function getPeopleRecognitionEngine(): PeopleRecognitionEngine {
  if (config.peoplePipeline.engine === 'none') {
    return noopEngine;
  }

  if (config.peoplePipeline.engine === 'rekognition') {
    return rekognitionEngine;
  }

  return mockEngine;
}
