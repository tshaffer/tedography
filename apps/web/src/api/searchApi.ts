/**
 * Partial SearchFilters returned by the Claude NL search endpoint.
 * Only fields Claude sets are included; the caller merges defaults for the rest.
 */
export interface NaturalLanguageSearchResult {
  photoStates?: string[];
  albumIds?: string[];
  groupIds?: string[];
  filenamePattern?: string;
  captureDateFrom?: string;
  captureDateTo?: string;
  captureDateAvailability?: 'datedOnly' | 'datedOrUndated' | 'undatedOnly';
  peopleIds?: string[];
  peopleMatchMode?: 'Any' | 'All';
  excludedPeopleIds?: string[];
  hasNoPeople?: boolean;
  hasKeywords?: boolean;
  keywordQuery?: {
    include: { keywordId: string; includeDescendants: boolean }[];
    includeMode: 'all' | 'any';
    exclude: { keywordId: string; includeDescendants: boolean }[];
  };
  isEditedImport?: boolean;
  hasEditedVersion?: boolean;
  inEditQueue?: boolean;
}

export async function translateNaturalLanguageSearch(
  query: string
): Promise<NaturalLanguageSearchResult> {
  const response = await fetch('/api/search/nl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const data = (await response.json()) as { filters: NaturalLanguageSearchResult };
  return data.filters;
}
