import type {
  YearAlbumCoverageDiagnosticType,
  YearAlbumCoverageResult,
  YearAlbumCoverageSummary
} from '@tedography/shared';

function buildErrorMessage(status: number, payload: unknown): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as { error?: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error;
  }

  return `Request failed with status ${status}`;
}

export async function getYearAlbumCoverageSummary(
  yearGroupId: string
): Promise<YearAlbumCoverageSummary> {
  const response = await fetch(
    `/api/organization/year-groups/${encodeURIComponent(yearGroupId)}/coverage-summary`
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as YearAlbumCoverageSummary;
}

export async function getYearAlbumCoverageAssets(
  yearGroupId: string,
  diagnosticType: YearAlbumCoverageDiagnosticType
): Promise<YearAlbumCoverageResult> {
  const params = new URLSearchParams({ diagnosticType });
  const response = await fetch(
    `/api/organization/year-groups/${encodeURIComponent(yearGroupId)}/coverage-assets?${params.toString()}`
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as unknown;
    throw new Error(buildErrorMessage(response.status, payload));
  }

  return (await response.json()) as YearAlbumCoverageResult;
}
