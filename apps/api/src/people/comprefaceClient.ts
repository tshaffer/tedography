import fs from 'node:fs/promises';
import { basename } from 'node:path';
import { config } from '../config.js';
import { PeopleRecognitionEngineError } from './recognitionEngine.js';

type CompreFaceDetectBox = {
  x_min?: number;
  y_min?: number;
  x_max?: number;
  y_max?: number;
  probability?: number;
};

type CompreFaceSubject = {
  subject?: string;
  similarity?: number;
};

type CompreFaceDetectionFace = {
  box?: CompreFaceDetectBox;
};

type CompreFaceRecognitionFace = {
  box?: CompreFaceDetectBox;
  subjects?: CompreFaceSubject[];
};

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function requireCompreFaceBaseUrl(): string {
  const baseUrl = config.peoplePipeline.compreface.baseUrl;
  if (!baseUrl) {
    throw new PeopleRecognitionEngineError(
      'CompreFace base URL is required when TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=compreface.',
      'config-missing'
    );
  }

  return normalizeBaseUrl(baseUrl);
}

function requireApiKey(type: 'detection' | 'recognition'): string {
  const key =
    type === 'detection'
      ? config.peoplePipeline.compreface.detectionApiKey
      : config.peoplePipeline.compreface.recognitionApiKey;
  if (!key) {
    throw new PeopleRecognitionEngineError(
      `CompreFace ${type} API key is required when the CompreFace adapter needs ${type}.`,
      'config-missing'
    );
  }

  return key;
}

async function createImageFormData(imagePath: string, extraFields?: Record<string, string>): Promise<FormData> {
  const data = await fs.readFile(imagePath);
  const formData = new FormData();
  formData.set('file', new Blob([data]), basename(imagePath));

  for (const [key, value] of Object.entries(extraFields ?? {})) {
    formData.set(key, value);
  }

  return formData;
}

async function requestJson<T>(input: {
  endpoint: string;
  apiKeyType: 'detection' | 'recognition';
  imagePath?: string;
  method?: 'GET' | 'POST';
  extraFields?: Record<string, string>;
}): Promise<T> {
  const baseUrl = requireCompreFaceBaseUrl();
  const apiKey = requireApiKey(input.apiKeyType);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.peoplePipeline.compreface.requestTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}${input.endpoint}`, {
      method: input.method ?? 'POST',
      headers: {
        'x-api-key': apiKey
      },
      ...(input.imagePath ? { body: await createImageFormData(input.imagePath, input.extraFields) } : {}),
      signal: controller.signal
    });

    if (!response.ok) {
      const payloadText = await response.text().catch(() => '');
      const suffix = payloadText.trim().length > 0 ? ` ${payloadText.trim()}` : '';
      throw new PeopleRecognitionEngineError(
        `CompreFace request failed with status ${response.status}.${suffix}`.trim(),
        response.status === 401 || response.status === 403 ? 'config-missing' : 'request-failed'
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof PeopleRecognitionEngineError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new PeopleRecognitionEngineError('CompreFace request timed out.', 'service-unavailable');
    }

    throw new PeopleRecognitionEngineError(
      error instanceof Error ? `CompreFace request failed: ${error.message}` : 'CompreFace request failed.',
      'service-unavailable'
    );
  } finally {
    clearTimeout(timeout);
  }
}

export interface CompreFaceDetectedFace {
  box: {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
    probability: number | null;
  };
}

export interface CompreFaceRecognizedFace extends CompreFaceDetectedFace {
  subjects: Array<{
    subject: string;
    similarity: number;
  }>;
}

export class CompreFaceClient {
  public async detectFaces(imagePath: string): Promise<CompreFaceDetectedFace[]> {
    const payload = await requestJson<{ result?: CompreFaceDetectionFace[] }>({
      endpoint: '/api/v1/detection/detect',
      apiKeyType: 'detection',
      imagePath,
      ...(config.peoplePipeline.compreface.detectionProbabilityThreshold !== null
        ? {
            extraFields: {
              det_prob_threshold: String(config.peoplePipeline.compreface.detectionProbabilityThreshold)
            }
          }
        : {})
    });

    const result = Array.isArray(payload.result) ? payload.result : null;
    if (!result) {
      throw new PeopleRecognitionEngineError('CompreFace detection response was malformed.', 'invalid-response');
    }

    return result.flatMap((item) => {
      const box = item.box;
      if (
        !box ||
        typeof box.x_min !== 'number' ||
        typeof box.y_min !== 'number' ||
        typeof box.x_max !== 'number' ||
        typeof box.y_max !== 'number'
      ) {
        return [];
      }

      return [
        {
          box: {
            xMin: box.x_min,
            yMin: box.y_min,
            xMax: box.x_max,
            yMax: box.y_max,
            probability: typeof box.probability === 'number' ? box.probability : null
          }
        }
      ];
    });
  }

  public async recognizeFaces(imagePath: string): Promise<CompreFaceRecognizedFace[]> {
    const payload = await requestJson<{ result?: CompreFaceRecognitionFace[] }>({
      endpoint: '/api/v1/recognition/recognize',
      apiKeyType: 'recognition',
      imagePath
    });

    const result = Array.isArray(payload.result) ? payload.result : null;
    if (!result) {
      throw new PeopleRecognitionEngineError('CompreFace recognition response was malformed.', 'invalid-response');
    }

    return result.flatMap((item) => {
      const box = item.box;
      if (
        !box ||
        typeof box.x_min !== 'number' ||
        typeof box.y_min !== 'number' ||
        typeof box.x_max !== 'number' ||
        typeof box.y_max !== 'number'
      ) {
        return [];
      }

      return [
        {
          box: {
            xMin: box.x_min,
            yMin: box.y_min,
            xMax: box.x_max,
            yMax: box.y_max,
            probability: typeof box.probability === 'number' ? box.probability : null
          },
          subjects: Array.isArray(item.subjects)
            ? item.subjects.flatMap((subject) =>
                typeof subject.subject === 'string' && typeof subject.similarity === 'number'
                  ? [{ subject: subject.subject, similarity: subject.similarity }]
                  : []
              )
            : []
        }
      ];
    });
  }

  public async addFaceExample(imagePath: string, subjectKey: string): Promise<{ exampleId?: string | null }> {
    const payload = await requestJson<{ image_id?: string | null }>({
      endpoint: '/api/v1/recognition/faces',
      apiKeyType: 'recognition',
      imagePath,
      extraFields: {
        subject: subjectKey
      }
    });

    return {
      exampleId: typeof payload.image_id === 'string' && payload.image_id.trim().length > 0 ? payload.image_id : null
    };
  }
}
