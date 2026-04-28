import type { FaceDetection, FaceMatchReview, Person, PersonFaceExample } from '@tedography/domain';

type PersonOption = Pick<Person, 'id' | 'displayName'>;

export interface FaceReviewActionStateInput {
  detection: Pick<FaceDetection, 'matchStatus' | 'matchedPersonId' | 'autoMatchCandidatePersonId'>;
  review?: Pick<FaceMatchReview, 'decision'> | null;
  matchedPerson?: PersonOption | null;
  suggestedPerson?: PersonOption | null;
}

export interface ConfirmActionState {
  isConfirmed: boolean;
  assignedPersonId: string | null;
  suggestedPersonId: string | null;
  canConfirm: boolean;
  label: string;
  isPassiveConfirmed: boolean;
}

export interface AssignmentActionState {
  isAlreadyAssigned: boolean;
  label: string;
  disabled: boolean;
}

export interface ExampleActionState {
  alreadyExampleForAssignedPerson: boolean;
  canAddAssignedPersonAsExample: boolean;
  label: string;
}

export function getFaceReviewActionState(input: FaceReviewActionStateInput): ConfirmActionState {
  const isConfirmed =
    input.detection.matchStatus === 'confirmed' ||
    input.review?.decision === 'confirmed' ||
    input.review?.decision === 'assignedToDifferentPerson';
  const assignedPersonId = input.detection.matchedPersonId ?? input.matchedPerson?.id ?? null;
  const suggestedPersonId = input.detection.autoMatchCandidatePersonId ?? input.suggestedPerson?.id ?? null;
  const assignedPersonName = input.matchedPerson?.displayName?.trim() ?? '';
  const suggestedPersonName = input.suggestedPerson?.displayName?.trim() ?? '';

  if (isConfirmed) {
    return {
      isConfirmed,
      assignedPersonId,
      suggestedPersonId,
      canConfirm: false,
      label: assignedPersonName.length > 0 ? `Confirmed as ${assignedPersonName}` : 'Confirmed',
      isPassiveConfirmed: true
    };
  }

  if (suggestedPersonName.length > 0 && suggestedPersonName !== assignedPersonName) {
    return {
      isConfirmed,
      assignedPersonId,
      suggestedPersonId,
      canConfirm: suggestedPersonId !== null,
      label: `Confirm Suggested (${suggestedPersonName})`,
      isPassiveConfirmed: false
    };
  }

  if (assignedPersonName.length > 0) {
    return {
      isConfirmed,
      assignedPersonId,
      suggestedPersonId,
      canConfirm: assignedPersonId !== null,
      label: `Confirm ${assignedPersonName}`,
      isPassiveConfirmed: false
    };
  }

  return {
    isConfirmed,
    assignedPersonId,
    suggestedPersonId,
    canConfirm: suggestedPersonId !== null || assignedPersonId !== null,
    label: 'Confirm',
    isPassiveConfirmed: false
  };
}

export function getAssignmentActionState(input: {
  faceState: Pick<ConfirmActionState, 'isConfirmed' | 'assignedPersonId'>;
  person: PersonOption;
  busy?: boolean;
}): AssignmentActionState {
  const isAlreadyAssigned =
    input.faceState.isConfirmed &&
    input.faceState.assignedPersonId !== null &&
    input.faceState.assignedPersonId === input.person.id;

  return {
    isAlreadyAssigned,
    label: isAlreadyAssigned ? `Assigned ${input.person.displayName}` : `Assign ${input.person.displayName}`,
    disabled: Boolean(input.busy) || isAlreadyAssigned
  };
}

export function getExampleActionState(input: {
  faceState: Pick<ConfirmActionState, 'isConfirmed' | 'assignedPersonId'>;
  detection: Pick<FaceDetection, 'id'>;
  assignedPersonName: string;
  examples: Array<Pick<PersonFaceExample, 'personId' | 'faceDetectionId' | 'status'>>;
  busy?: boolean;
}): ExampleActionState {
  const assignedPersonName = input.assignedPersonName.trim();
  const alreadyExampleForAssignedPerson =
    input.faceState.assignedPersonId !== null &&
    input.examples.some(
      (example) =>
        example.status === 'active' &&
        example.personId === input.faceState.assignedPersonId &&
        example.faceDetectionId === input.detection.id
    );
  const hasAssignedPerson = input.faceState.assignedPersonId !== null && assignedPersonName.length > 0;

  return {
    alreadyExampleForAssignedPerson,
    canAddAssignedPersonAsExample:
      input.faceState.isConfirmed &&
      hasAssignedPerson &&
      !alreadyExampleForAssignedPerson &&
      !input.busy,
    label: alreadyExampleForAssignedPerson && assignedPersonName.length > 0
      ? `Added ${assignedPersonName} As Example`
      : assignedPersonName.length > 0
        ? `Add ${assignedPersonName} As Example`
        : 'Add As Example'
  };
}
