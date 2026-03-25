import type { Person } from '@tedography/domain';

const prefix = 'person_';
const legacyPrefix = 'tedography-person-';

function stripUuidHyphens(value: string): string {
  return value.trim().replace(/-/g, '').toLowerCase();
}

function restoreUuidHyphens(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    return null;
  }

  return [
    normalized.slice(0, 8),
    normalized.slice(8, 12),
    normalized.slice(12, 16),
    normalized.slice(16, 20),
    normalized.slice(20)
  ].join('-');
}

export function buildPeopleEngineIdentityKey(person: Pick<Person, 'id'>): string {
  return `${prefix}${stripUuidHyphens(person.id)}`;
}

export function parsePeopleEngineIdentityKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith(prefix)) {
    if (!trimmed.startsWith(legacyPrefix)) {
      return null;
    }

    const legacyPersonId = trimmed.slice(legacyPrefix.length).trim();
    return legacyPersonId.length > 0 ? legacyPersonId : null;
  }

  const personId = trimmed.slice(prefix.length).trim();
  return restoreUuidHyphens(personId);
}
