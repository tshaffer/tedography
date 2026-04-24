import type { Keyword } from '@tedography/domain';

export function buildKeywordMap(keywords: Keyword[]): Map<string, Keyword> {
  return new Map(keywords.map((keyword) => [keyword.id, keyword]));
}

export function getKeywordPathLabels(
  keyword: Keyword,
  keywordMap: Map<string, Keyword>
): string[] {
  const labels: string[] = [];
  let current: Keyword | undefined = keyword;
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    labels.unshift(current.label);
    const parentId: string | null = current.parentKeywordId ?? null;
    current = parentId ? keywordMap.get(parentId) : undefined;
  }

  return labels;
}

export function formatKeywordPathLabel(
  keyword: Keyword,
  keywordMap: Map<string, Keyword>
): string {
  return getKeywordPathLabels(keyword, keywordMap).join(' / ');
}

export function sortKeywordsByPath(keywords: Keyword[]): Keyword[] {
  const keywordMap = buildKeywordMap(keywords);

  return [...keywords].sort((left, right) => {
    const leftLabel = formatKeywordPathLabel(left, keywordMap);
    const rightLabel = formatKeywordPathLabel(right, keywordMap);
    const labelCompare = leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' });
    if (labelCompare !== 0) {
      return labelCompare;
    }

    return left.id.localeCompare(right.id);
  });
}

export function collectKeywordDescendantIds(
  keywords: Keyword[],
  rootKeywordId: string
): Set<string> {
  const descendants = new Set<string>([rootKeywordId]);
  const queue = [rootKeywordId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }

    for (const keyword of keywords) {
      if (keyword.parentKeywordId === currentId && !descendants.has(keyword.id)) {
        descendants.add(keyword.id);
        queue.push(keyword.id);
      }
    }
  }

  return descendants;
}
