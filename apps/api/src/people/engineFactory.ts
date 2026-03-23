import { config } from '../config.js';
import { MockRecognitionEngine } from './mockRecognitionEngine.js';
import { NoopRecognitionEngine } from './noopRecognitionEngine.js';
import type { PeopleRecognitionEngine } from './recognitionEngine.js';

const mockEngine = new MockRecognitionEngine();
const noopEngine = new NoopRecognitionEngine();

export function getPeopleRecognitionEngine(): PeopleRecognitionEngine {
  if (config.peoplePipeline.engine === 'none') {
    return noopEngine;
  }

  return mockEngine;
}
