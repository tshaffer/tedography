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
  DisassociateFacesCommand: new (input: object) => object;
  DeleteFacesCommand: new (input: object) => object;
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
const REKOGNITION_IMAGE_BYTES_LIMIT = 5_242_880;
const REKOGNITION_IMAGE_BYTES_TARGET = 4_800_000;

type SharpLikeModule = {
  default: (input: string | Uint8Array) => SharpLikePipeline;
};

type SharpLikePipeline = {
  rotate(): SharpLikePipeline;
  resize(options: { width?: number; height?: number; fit?: 'inside'; withoutEnlargement?: boolean }): SharpLikePipeline;
  jpeg(options?: { quality?: number; mozjpeg?: boolean }): SharpLikePipeline;
  toBuffer(): Promise<Uint8Array>;
};

type ImagePreparationMode = 'default' | 'aggressive';

let sharpModulePromise: Promise<SharpLikeModule> | null = null;

async function loadAwsSdkModule(): Promise<AwsSdkModule> {
  if (!sdkModulePromise) {
    const moduleName = '@aws-sdk/client-rekognition';
    sdkModulePromise = import(moduleName) as Promise<AwsSdkModule>;
  }

  return sdkModulePromise;
}

async function loadSharpModule(): Promise<SharpLikeModule> {
  if (!sharpModulePromise) {
    const moduleName = 'sharp';
    sharpModulePromise = import(moduleName) as Promise<SharpLikeModule>;
  }

  return sharpModulePromise;
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

function getErrorMessage(error: unknown): string {
  return typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
}

export function isRekognitionImageBytesTooLargeError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    getErrorName(error) === 'InvalidParameterException' &&
    message.includes("image.bytes") &&
    message.includes('5242880')
  );
}

async function encodeJpegToTargetSize(inputPath: string, mode: ImagePreparationMode): Promise<Uint8Array> {
  const sharpModule = await loadSharpModule();
  const attempts =
    mode === 'aggressive'
      ? [
          { maxDimension: 1800, quality: 76 },
          { maxDimension: 1440, quality: 68 },
          { maxDimension: 1200, quality: 62 }
        ]
      : [
          { maxDimension: 2560, quality: 86 },
          { maxDimension: 2200, quality: 80 },
          { maxDimension: 1800, quality: 74 }
        ];

  let smallestBuffer: Uint8Array | null = null;

  for (const attempt of attempts) {
    const buffer = await (sharpModule.default(inputPath) as SharpLikePipeline)
      .rotate()
      .resize({
        width: attempt.maxDimension,
        height: attempt.maxDimension,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: attempt.quality, mozjpeg: true })
      .toBuffer();

    if (!smallestBuffer || buffer.byteLength < smallestBuffer.byteLength) {
      smallestBuffer = buffer;
    }

    if (buffer.byteLength <= REKOGNITION_IMAGE_BYTES_TARGET) {
      return normalizeBytes(buffer);
    }
  }

  return normalizeBytes(smallestBuffer ?? new Uint8Array());
}

async function prepareImageBytes(inputPath: string, mode: ImagePreparationMode): Promise<Uint8Array> {
  const rawBytes = normalizeBytes(await fs.readFile(inputPath));
  if (rawBytes.byteLength <= REKOGNITION_IMAGE_BYTES_LIMIT && mode === 'default') {
    return rawBytes;
  }

  return encodeJpegToTargetSize(inputPath, mode);
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

function wrapEnrollmentStepError(
  error: unknown,
  fallbackMessage: string,
  code: PeopleRecognitionEngineError['code']
): PeopleRecognitionEngineError {
  const detail = getErrorMessage(error).trim();
  return new PeopleRecognitionEngineError(
    detail.length > 0 ? `${fallbackMessage} ${detail}` : fallbackMessage,
    code
  );
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

  private async sendImageCommandWithPreparedBytes<T>(input: {
    commandName: 'DetectFacesCommand' | 'SearchUsersByImageCommand' | 'IndexFacesCommand';
    imagePath: string;
    buildInput: (bytes: Uint8Array) => object;
    fallbackMessage: string;
  }): Promise<T> {
    let bytes = await prepareImageBytes(input.imagePath, 'default');

    try {
      return (await this.send(input.commandName, input.buildInput(bytes))) as T;
    } catch (error) {
      if (!isRekognitionImageBytesTooLargeError(error)) {
        throw error;
      }

      bytes = await prepareImageBytes(input.imagePath, 'aggressive');
      if (bytes.byteLength > REKOGNITION_IMAGE_BYTES_LIMIT) {
        throw new PeopleRecognitionEngineError(
          `Image payload is still too large for Rekognition after recompression (${bytes.byteLength} bytes).`,
          'request-failed'
        );
      }

      try {
        return (await this.send(input.commandName, input.buildInput(bytes))) as T;
      } catch (retryError) {
        throw mapAwsError(retryError, input.fallbackMessage);
      }
    }
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

    const response = await this.sendImageCommandWithPreparedBytes<{
      FaceDetails?: DetectFaceDetail[];
    }>({
      commandName: 'DetectFacesCommand',
      imagePath,
      buildInput: (bytes) => ({
        Image: { Bytes: bytes },
        Attributes: ['DEFAULT']
      }),
      fallbackMessage: 'Rekognition DetectFaces request failed.'
    });

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

    const threshold = config.peoplePipeline.rekognition.faceMatchThreshold;
    const response = await this.sendImageCommandWithPreparedBytes<{
      UserMatches?: SearchUserMatch[];
    }>({
      commandName: 'SearchUsersByImageCommand',
      imagePath,
      buildInput: (bytes) => ({
        CollectionId: requireCollectionId(),
        Image: { Bytes: bytes },
        ...(threshold !== null ? { FaceMatchThreshold: threshold * 100 } : {}),
        MaxUsers: Math.max(1, Math.floor(config.peoplePipeline.rekognition.maxResults)),
        QualityFilter: 'AUTO'
      }),
      fallbackMessage: 'Rekognition SearchUsersByImage request failed.'
    });

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
      const message = getErrorMessage(error);
      const looksLikeExistingUserFallback =
        name === 'InvalidParameterException' && message.includes('Request has invalid parameters');

      // Rekognition's CreateUser can return a generic InvalidParameterException
      // when the user already exists in the collection. Treat that like an
      // already-created user so enrollment can continue to IndexFaces/AssociateFaces.
      if (
        name !== 'ConflictException' &&
        name !== 'ResourceAlreadyExistsException' &&
        !looksLikeExistingUserFallback
      ) {
        throw wrapEnrollmentStepError(
          error,
          'Failed to create Rekognition user for enrollment. Check Rekognition user support, IAM permissions, and user-id constraints.',
          'request-failed'
        );
      }
    }
  }

  public async enrollUserFaceExample(input: {
    userId: string;
    imagePath: string;
    externalImageId: string;
  }): Promise<RekognitionEnrollmentResult> {
    await this.ensureUserExists(input.userId);

    let indexResponse: {
      FaceRecords?: IndexFaceRecord[];
    };
    try {
      indexResponse = await this.sendImageCommandWithPreparedBytes<{
        FaceRecords?: IndexFaceRecord[];
      }>({
        commandName: 'IndexFacesCommand',
        imagePath: input.imagePath,
        buildInput: (bytes) => ({
          CollectionId: requireCollectionId(),
          Image: { Bytes: bytes },
          ExternalImageId: input.externalImageId,
          MaxFaces: 1,
          QualityFilter: 'AUTO',
          DetectionAttributes: ['DEFAULT']
        }),
        fallbackMessage: 'Failed to index face example in Rekognition.'
      });
    } catch (error) {
      throw wrapEnrollmentStepError(
        error,
        'Failed to index face example in Rekognition. The crop may not contain a clear, usable single face, or the Rekognition request parameters may be invalid.',
        'request-failed'
      );
    }

    const faceIds = (Array.isArray(indexResponse.FaceRecords) ? indexResponse.FaceRecords : [])
      .flatMap((record) => (typeof record.Face?.FaceId === 'string' ? [record.Face.FaceId] : []));

    if (faceIds.length === 0) {
      throw new PeopleRecognitionEngineError(
        'Rekognition did not return an indexable face for the supplied example crop.',
        'invalid-response'
      );
    }

    try {
      await this.send('AssociateFacesCommand', {
        CollectionId: requireCollectionId(),
        UserId: input.userId,
        FaceIds: faceIds
      });
    } catch (error) {
      throw wrapEnrollmentStepError(
        error,
        'Failed to associate indexed face with the Rekognition user. Check collection user support and IAM permissions.',
        'request-failed'
      );
    }

    return {
      userId: input.userId,
      faceIds
    };
  }

  public async removeUserFaceExample(input: {
    userId: string;
    faceId: string;
  }): Promise<void> {
    await this.ensureCollectionExists();

    try {
      await this.send('DisassociateFacesCommand', {
        CollectionId: requireCollectionId(),
        UserId: input.userId,
        FaceIds: [input.faceId]
      });
    } catch (error) {
      throw wrapEnrollmentStepError(
        error,
        'Failed to disassociate face example from the Rekognition user.',
        'request-failed'
      );
    }

    try {
      await this.send('DeleteFacesCommand', {
        CollectionId: requireCollectionId(),
        FaceIds: [input.faceId]
      });
    } catch (error) {
      throw wrapEnrollmentStepError(
        error,
        'Failed to delete face example from the Rekognition collection.',
        'request-failed'
      );
    }
  }
}
