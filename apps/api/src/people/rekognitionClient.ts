import fs from 'node:fs/promises';
import { config } from '../config.js';
import { PeopleRecognitionEngineError } from './recognitionEngine.js';

type AwsSdkModule = {
  RekognitionClient: new (config: { region: string; maxAttempts?: number }) => {
    send(command: object): Promise<unknown>;
  };
  DetectFacesCommand: new (input: object) => object;
  SearchUsersByImageCommand: new (input: object) => object;
  DescribeCollectionCommand: new (input: object) => object;
  CreateCollectionCommand: new (input: object) => object;
  CreateUserCommand: new (input: object) => object;
  IndexFacesCommand: new (input: object) => object;
  AssociateFacesCommand: new (input: object) => object;
};

type DetectFaceBoundingBox = {
  Left?: number;
  Top?: number;
  Width?: number;
  Height?: number;
};

type DetectFaceQuality = {
  Sharpness?: number;
};

type DetectFaceDetail = {
  BoundingBox?: DetectFaceBoundingBox;
  Confidence?: number;
  Quality?: DetectFaceQuality;
};

type SearchUserRecord = {
  UserId?: string;
};

type SearchUserMatch = {
  Similarity?: number;
  User?: SearchUserRecord;
};

type IndexFaceRecord = {
  Face?: {
    FaceId?: string;
  };
};

let sdkModulePromise: Promise<AwsSdkModule> | null = null;

async function loadAwsSdkModule(): Promise<AwsSdkModule> {
  if (!sdkModulePromise) {
    const moduleName = '@aws-sdk/client-rekognition';
    sdkModulePromise = import(moduleName) as Promise<AwsSdkModule>;
  }

  return sdkModulePromise;
}

function requireRekognitionRegion(): string {
  const region = config.peoplePipeline.rekognition.region;
  if (!region) {
    throw new PeopleRecognitionEngineError(
      'AWS region is required when TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=rekognition.',
      'config-missing'
    );
  }

  return region;
}

function requireCollectionId(): string {
  const collectionId = config.peoplePipeline.rekognition.collectionId;
  if (!collectionId) {
    throw new PeopleRecognitionEngineError(
      'TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_COLLECTION_ID is required when TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=rekognition.',
      'config-missing'
    );
  }

  return collectionId;
}

function normalizeBytes(input: Uint8Array): Uint8Array {
  return input.byteOffset === 0 && input.byteLength === input.buffer.byteLength
    ? input
    : new Uint8Array(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
}

function getErrorName(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
}

function mapAwsError(error: unknown, fallbackMessage: string): PeopleRecognitionEngineError {
  if (error instanceof PeopleRecognitionEngineError) {
    return error;
  }

  const name = getErrorName(error);
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : fallbackMessage;

  if (
    name === 'UnrecognizedClientException' ||
    name === 'InvalidSignatureException' ||
    name === 'AccessDeniedException' ||
    name === 'ResourceNotFoundException'
  ) {
    return new PeopleRecognitionEngineError(message, 'config-missing');
  }

  if (
    name === 'ProvisionedThroughputExceededException' ||
    name === 'ThrottlingException' ||
    name === 'InternalServerError' ||
    name === 'TimeoutError'
  ) {
    return new PeopleRecognitionEngineError(message, 'service-unavailable');
  }

  if (name === 'InvalidParameterException') {
    return new PeopleRecognitionEngineError(message, 'request-failed');
  }

  return new PeopleRecognitionEngineError(message, 'service-unavailable');
}

export interface RekognitionDetectedFace {
  boundingBox: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  confidence: number | null;
  qualityScore: number | null;
}

export interface RekognitionUserMatch {
  userId: string;
  similarity: number;
}

export interface RekognitionEnrollmentResult {
  userId: string;
  faceIds: string[];
}

export class RekognitionClient {
  private clientPromise: Promise<{ send(command: object): Promise<unknown> }> | null = null;
  private collectionReadyPromise: Promise<void> | null = null;

  private async getSdk(): Promise<AwsSdkModule> {
    try {
      return await loadAwsSdkModule();
    } catch (error) {
      throw new PeopleRecognitionEngineError(
        error instanceof Error
          ? `AWS Rekognition SDK is not installed: ${error.message}`
          : 'AWS Rekognition SDK is not installed.',
        'config-missing'
      );
    }
  }

  private async getClient(): Promise<{ send(command: object): Promise<unknown> }> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const sdk = await this.getSdk();
        return new sdk.RekognitionClient({
          region: requireRekognitionRegion(),
          maxAttempts: Math.max(1, Math.floor(config.peoplePipeline.rekognition.maxAttempts))
        });
      })();
    }

    return this.clientPromise;
  }

  private async send(commandName: keyof AwsSdkModule, input: object): Promise<unknown> {
    try {
      return await this.sendRaw(commandName, input);
    } catch (error) {
      throw mapAwsError(error, `Rekognition ${String(commandName)} request failed.`);
    }
  }

  private async sendRaw(commandName: keyof AwsSdkModule, input: object): Promise<unknown> {
    const sdk = await this.getSdk();
    const client = await this.getClient();
    const Command = sdk[commandName] as new (payload: object) => object;

    return client.send(new Command(input));
  }

  public async ensureCollectionExists(): Promise<void> {
    if (!this.collectionReadyPromise) {
      this.collectionReadyPromise = (async () => {
        const collectionId = requireCollectionId();

        try {
          await this.sendRaw('DescribeCollectionCommand', {
            CollectionId: collectionId
          });
          return;
        } catch (error) {
          if (getErrorName(error) !== 'ResourceNotFoundException') {
            throw mapAwsError(error, 'Failed to describe Rekognition collection.');
          }
        }

        try {
          await this.sendRaw('CreateCollectionCommand', {
            CollectionId: collectionId
          });
        } catch (error) {
          if (getErrorName(error) !== 'ResourceAlreadyExistsException') {
            throw mapAwsError(error, 'Failed to create Rekognition collection.');
          }
        }
      })();
    }

    try {
      await this.collectionReadyPromise;
    } catch (error) {
      this.collectionReadyPromise = null;
      throw error;
    }
  }

  public async detectFaces(imagePath: string): Promise<RekognitionDetectedFace[]> {
    await this.ensureCollectionExists();

    const bytes = normalizeBytes(await fs.readFile(imagePath));
    const response = (await this.send('DetectFacesCommand', {
      Image: { Bytes: bytes },
      Attributes: ['DEFAULT']
    })) as {
      FaceDetails?: DetectFaceDetail[];
    };

    const faceDetails = Array.isArray(response.FaceDetails) ? response.FaceDetails : [];
    return faceDetails.flatMap((item) => {
      const box = item.BoundingBox;
      if (
        !box ||
        typeof box.Left !== 'number' ||
        typeof box.Top !== 'number' ||
        typeof box.Width !== 'number' ||
        typeof box.Height !== 'number'
      ) {
        return [];
      }

      return [
        {
          boundingBox: {
            left: box.Left,
            top: box.Top,
            width: box.Width,
            height: box.Height
          },
          confidence: typeof item.Confidence === 'number' ? item.Confidence / 100 : null,
          qualityScore: typeof item.Quality?.Sharpness === 'number' ? item.Quality.Sharpness / 100 : null
        }
      ];
    });
  }

  public async searchUsersByImage(imagePath: string): Promise<RekognitionUserMatch[]> {
    await this.ensureCollectionExists();

    const bytes = normalizeBytes(await fs.readFile(imagePath));
    const threshold = config.peoplePipeline.rekognition.faceMatchThreshold;
    const response = (await this.send('SearchUsersByImageCommand', {
      CollectionId: requireCollectionId(),
      Image: { Bytes: bytes },
      ...(threshold !== null ? { FaceMatchThreshold: threshold * 100 } : {}),
      MaxUsers: Math.max(1, Math.floor(config.peoplePipeline.rekognition.maxResults)),
      QualityFilter: 'AUTO'
    })) as {
      UserMatches?: SearchUserMatch[];
    };

    const matches = Array.isArray(response.UserMatches) ? response.UserMatches : [];
    return matches.flatMap((item) => {
      if (typeof item.User?.UserId !== 'string' || typeof item.Similarity !== 'number') {
        return [];
      }

      return [
        {
          userId: item.User.UserId,
          similarity: item.Similarity / 100
        }
      ];
    });
  }

  public async ensureUserExists(userId: string): Promise<void> {
    await this.ensureCollectionExists();

    try {
      await this.sendRaw('CreateUserCommand', {
        CollectionId: requireCollectionId(),
        UserId: userId
      });
    } catch (error) {
      const name = getErrorName(error);
      if (name !== 'ConflictException' && name !== 'ResourceAlreadyExistsException') {
        throw mapAwsError(error, 'Failed to create Rekognition user.');
      }
    }
  }

  public async enrollUserFaceExample(input: {
    userId: string;
    imagePath: string;
    externalImageId: string;
  }): Promise<RekognitionEnrollmentResult> {
    await this.ensureUserExists(input.userId);

    const bytes = normalizeBytes(await fs.readFile(input.imagePath));
    const indexResponse = (await this.send('IndexFacesCommand', {
      CollectionId: requireCollectionId(),
      Image: { Bytes: bytes },
      ExternalImageId: input.externalImageId,
      MaxFaces: 1,
      QualityFilter: 'AUTO',
      DetectionAttributes: ['DEFAULT']
    })) as {
      FaceRecords?: IndexFaceRecord[];
    };

    const faceIds = (Array.isArray(indexResponse.FaceRecords) ? indexResponse.FaceRecords : [])
      .flatMap((record) => (typeof record.Face?.FaceId === 'string' ? [record.Face.FaceId] : []));

    if (faceIds.length === 0) {
      throw new PeopleRecognitionEngineError(
        'Rekognition did not return an indexable face for the supplied example crop.',
        'invalid-response'
      );
    }

    await this.send('AssociateFacesCommand', {
      CollectionId: requireCollectionId(),
      UserId: input.userId,
      FaceIds: faceIds
    });

    return {
      userId: input.userId,
      faceIds
    };
  }
}
