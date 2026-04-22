import type { GetPersonPhotosResponse } from '@tedography/shared';
import { findPersonById } from '../repositories/personRepository.js';
import { getPhotosForPersonOrderedByEstimatedAge } from '../repositories/faceDetectionAssignmentRepository.js';

export async function getPersonPhotosByEstimatedAge(input: {
  personId: string;
  sortDirection?: 'asc' | 'desc';
  uniquePhotosOnly?: boolean;
}): Promise<GetPersonPhotosResponse | null> {
  const person = await findPersonById(input.personId);
  if (!person) {
    return null;
  }

  const sortDirection = input.sortDirection === 'desc' ? 'desc' : 'asc';
  const uniquePhotosOnly = input.uniquePhotosOnly !== false;
  const items = await getPhotosForPersonOrderedByEstimatedAge(input.personId, {
    sortDirection,
    uniquePhotosOnly
  });

  return {
    personId: input.personId,
    sortBy: 'estimatedAge',
    sortDirection,
    uniquePhotosOnly,
    items
  };
}
