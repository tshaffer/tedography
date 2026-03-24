import type { Person } from '@tedography/domain';

const prefix = 'tedography-person-';

export function buildPeopleEngineIdentityKey(person: Pick<Person, 'id'>): string {
  return `${prefix}${person.id}`;
}

export function parsePeopleEngineIdentityKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith(prefix)) {
    return null;
  }

  const personId = trimmed.slice(prefix.length).trim();
  return personId.length > 0 ? personId : null;
}
