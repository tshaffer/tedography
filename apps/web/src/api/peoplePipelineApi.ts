import type {
  CreatePersonRequest,
  CreatePersonResponse,
  ListAssetFaceDetectionsResponse,
  ListPeopleResponse,
  ListPeoplePipelineRecentAssetsResponse,
  ListPeopleReviewQueueResponse,
  ProcessPeopleAssetResponse,
  ReviewFaceDetectionRequest,
  ReviewFaceDetectionResponse
} from '@tedography/shared';
import type { FaceDetectionMatchStatus } from '@tedography/domain';

type ApiErrorPayload = {
  error?: string;
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function listPeople(): Promise<ListPeopleResponse> {
  return fetchJson<ListPeopleResponse>('/api/people-pipeline/people');
}

export async function createPerson(
  request: CreatePersonRequest
): Promise<CreatePersonResponse> {
  return fetchJson<CreatePersonResponse>('/api/people-pipeline/people', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function listPeopleReviewQueue(input?: {
  statuses?: FaceDetectionMatchStatus[];
  assetId?: string;
  limit?: number;
}): Promise<ListPeopleReviewQueueResponse> {
  const query = new URLSearchParams();

  if (input?.statuses && input.statuses.length > 0) {
    query.set('statuses', input.statuses.join(','));
  }

  if (input?.assetId) {
    query.set('assetId', input.assetId);
  }

  if (input?.limit !== undefined) {
    query.set('limit', String(input.limit));
  }

  const search = query.toString();
  return fetchJson<ListPeopleReviewQueueResponse>(
    `/api/people-pipeline/review${search.length > 0 ? `?${search}` : ''}`
  );
}

export async function listPeoplePipelineRecentAssets(input?: {
  limit?: number;
}): Promise<ListPeoplePipelineRecentAssetsResponse> {
  const query = new URLSearchParams();
  if (input?.limit !== undefined) {
    query.set('limit', String(input.limit));
  }

  const search = query.toString();
  return fetchJson<ListPeoplePipelineRecentAssetsResponse>(
    `/api/people-pipeline/dev/recent-assets${search.length > 0 ? `?${search}` : ''}`
  );
}

export async function getPeoplePipelineAssetState(
  assetId: string
): Promise<ListAssetFaceDetectionsResponse> {
  return fetchJson<ListAssetFaceDetectionsResponse>(
    `/api/people-pipeline/assets/${encodeURIComponent(assetId)}`
  );
}

export async function processPeopleAsset(
  assetId: string,
  input?: { force?: boolean }
): Promise<ProcessPeopleAssetResponse> {
  return fetchJson<ProcessPeopleAssetResponse>(
    `/api/people-pipeline/assets/${encodeURIComponent(assetId)}/process`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input ?? {})
    }
  );
}

export async function reviewFaceDetection(
  detectionId: string,
  request: ReviewFaceDetectionRequest
): Promise<ReviewFaceDetectionResponse> {
  return fetchJson<ReviewFaceDetectionResponse>(
    `/api/people-pipeline/detections/${encodeURIComponent(detectionId)}/review`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    }
  );
}
