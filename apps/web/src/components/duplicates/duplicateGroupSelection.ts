import type { DuplicateGroupListItem } from '@tedography/shared';

export function getSelectedCanonicalAssetId(group: DuplicateGroupListItem): string {
  return group.selectedCanonicalAssetId;
}

export function replaceDuplicateGroupInList(
  groups: DuplicateGroupListItem[],
  updatedGroup: DuplicateGroupListItem
): DuplicateGroupListItem[] {
  return groups.map((group) => (group.groupKey === updatedGroup.groupKey ? updatedGroup : group));
}
