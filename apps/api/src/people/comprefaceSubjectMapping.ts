import type { Person } from '@tedography/domain';

export function buildCompreFaceSubjectKey(person: Pick<Person, 'id'>): string {
  return `tedography-person-${person.id}`;
}

export function parseCompreFaceSubjectKey(subject: string): string | null {
  const trimmed = subject.trim();
  if (!trimmed.startsWith('tedography-person-')) {
    return null;
  }

  const personId = trimmed.slice('tedography-person-'.length).trim();
  return personId.length > 0 ? personId : null;
}
