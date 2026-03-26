import type {
  CreatePersonRequest,
  CreatePersonResponse,
  EnrollPersonFromDetectionRequest,
  EnrollPersonFromDetectionResponse,
  GetPersonDetailResponse,
  ListAssetFaceDetectionsResponse,
  ListPeopleBrowseResponse,
  ListPeopleResponse,
  ListPeoplePipelineRecentAssetsResponse,
  MergePersonRequest,
  MergePersonResponse,
  RemovePersonExampleResponse,
  PeoplePipelineSummaryResponse,
  PeopleReviewQueueSort,
  ListPeopleReviewQueueResponse,
  ProcessPeopleAssetResponse,
  SplitPersonRequest,
  SplitPersonResponse,
  UpdatePersonRequest,
  UpdatePersonResponse,
  ReviewFaceDetectionRequest,
  ReviewFaceDetectionResponse
} from '@tedography/shared';
import type { FaceDetectionMatchStatus } from '@tedography/domain';

type AssetIdsScopeRequest = {
  assetIds: string[];
};

export interface PeopleScopedAssetSummaryResponse {
  totalAssets: number;
  assetsWithConfirmedPeople: number;
  assetsWithoutConfirmedPeople: number;
  assetsWithReviewableFaces: number;
  totalReviewableDetections: number;
}

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

export async function listPeople(input?: { signal?: AbortSignal }): Promise<ListPeopleResponse> {
  return fetchJson<ListPeopleResponse>('/api/people-pipeline/people', {
    ...(input?.signal ? { signal: input.signal } : {})
  });
}

export async function listPeopleBrowse(): Promise<ListPeopleBrowseResponse> {
  return fetchJson<ListPeopleBrowseResponse>('/api/people-pipeline/people/browse');
}

export async function getPersonDetail(personId: string): Promise<GetPersonDetailResponse> {
  return fetchJson<GetPersonDetailResponse>(`/api/people-pipeline/people/${encodeURIComponent(personId)}`);
}

export async function updatePerson(
  personId: string,
  request: UpdatePersonRequest
): Promise<UpdatePersonResponse> {
  return fetchJson<UpdatePersonResponse>(
    `/api/people-pipeline/people/${encodeURIComponent(personId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    }
  );
}

export async function removePersonExample(
  personId: string,
  exampleId: string
): Promise<RemovePersonExampleResponse> {
  return fetchJson<RemovePersonExampleResponse>(
    `/api/people-pipeline/people/${encodeURIComponent(personId)}/examples/${encodeURIComponent(exampleId)}`,
    {
      method: 'DELETE'
    }
  );
}

export async function mergePerson(
  personId: string,
  request: MergePersonRequest
): Promise<MergePersonResponse> {
  return fetchJson<MergePersonResponse>(
    `/api/people-pipeline/people/${encodeURIComponent(personId)}/merge`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    }
  );
}

export async function splitPerson(
  personId: string,
  request: SplitPersonRequest
): Promise<SplitPersonResponse> {
  return fetchJson<SplitPersonResponse>(
    `/api/people-pipeline/people/${encodeURIComponent(personId)}/split`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    }
  );
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
  assetIds?: string[];
  personId?: string;
  limit?: number;
  sort?: PeopleReviewQueueSort;
}): Promise<ListPeopleReviewQueueResponse> {
  if (input?.assetIds && input.assetIds.length > 0) {
    return fetchJson<ListPeopleReviewQueueResponse>('/api/people-pipeline/review/scoped', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assetIds: input.assetIds,
        ...(input.statuses ? { statuses: input.statuses } : {}),
        ...(input.personId ? { personId: input.personId } : {}),
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.sort ? { sort: input.sort } : {})
      })
    });
  }

  const query = new URLSearchParams();

  if (input?.statuses && input.statuses.length > 0) {
    query.set('statuses', input.statuses.join(','));
  }

  if (input?.assetId) {
    query.set('assetId', input.assetId);
  }

  if (input?.personId) {
    query.set('personId', input.personId);
  }

  if (input?.limit !== undefined) {
    query.set('limit', String(input.limit));
  }

  if (input?.sort) {
    query.set('sort', input.sort);
  }

  const search = query.toString();
  return fetchJson<ListPeopleReviewQueueResponse>(
    `/api/people-pipeline/review${search.length > 0 ? `?${search}` : ''}`
  );
}

export async function getPeopleScopedAssetSummary(
  request: AssetIdsScopeRequest
): Promise<PeopleScopedAssetSummaryResponse> {
  return fetchJson<PeopleScopedAssetSummaryResponse>('/api/people-pipeline/scopes/asset-summary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
}

export async function getPeoplePipelineSummary(): Promise<PeoplePipelineSummaryResponse> {
  return fetchJson<PeoplePipelineSummaryResponse>('/api/people-pipeline/summary');
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

export async function enrollPersonFromDetection(
  personId: string,
  request: EnrollPersonFromDetectionRequest
): Promise<EnrollPersonFromDetectionResponse> {
  return fetchJson<EnrollPersonFromDetectionResponse>(
    `/api/people-pipeline/people/${encodeURIComponent(personId)}/enroll-from-detection`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    }
  );
}
