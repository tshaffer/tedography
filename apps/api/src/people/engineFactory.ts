import { CompreFaceRecognitionEngine } from './comprefaceRecognitionEngine.js';
import { config } from '../config.js';
import { MockRecognitionEngine } from './mockRecognitionEngine.js';
import { NoopRecognitionEngine } from './noopRecognitionEngine.js';
import type { PeopleRecognitionEngine } from './recognitionEngine.js';

const comprefaceEngine = new CompreFaceRecognitionEngine();
const mockEngine = new MockRecognitionEngine();
const noopEngine = new NoopRecognitionEngine();

export function getPeopleRecognitionEngine(): PeopleRecognitionEngine {
  if (config.peoplePipeline.engine === 'none') {
    return noopEngine;
  }

  if (config.peoplePipeline.engine === 'compreface') {
    return comprefaceEngine;
  }

  return mockEngine;
}
