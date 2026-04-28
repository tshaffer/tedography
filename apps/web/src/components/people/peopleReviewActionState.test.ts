import assert from 'node:assert/strict';
import test from 'node:test';
import { getAssignmentActionState, getExampleActionState, getFaceReviewActionState } from './peopleReviewActionState';

test('confirmed face gets passive confirmed action label instead of active confirm', () => {
  const state = getFaceReviewActionState({
    detection: {
      matchStatus: 'confirmed',
      matchedPersonId: 'person-rachel',
      autoMatchCandidatePersonId: 'person-rachel'
    },
    review: { decision: 'confirmed' },
    matchedPerson: { id: 'person-rachel', displayName: 'Rachel' },
    suggestedPerson: { id: 'person-rachel', displayName: 'Rachel' }
  });

  assert.equal(state.isConfirmed, true);
  assert.equal(state.canConfirm, false);
  assert.equal(state.isPassiveConfirmed, true);
  assert.equal(state.label, 'Confirmed as Rachel');
});

test('pending suggested face gets active confirm suggested action', () => {
  const state = getFaceReviewActionState({
    detection: {
      matchStatus: 'suggested',
      matchedPersonId: null,
      autoMatchCandidatePersonId: 'person-rachel'
    },
    review: { decision: 'pending' },
    suggestedPerson: { id: 'person-rachel', displayName: 'Rachel' }
  });

  assert.equal(state.isConfirmed, false);
  assert.equal(state.canConfirm, true);
  assert.equal(state.isPassiveConfirmed, false);
  assert.equal(state.label, 'Confirm Suggested (Rachel)');
});

test('already assigned quick action is disabled and relabelled', () => {
  const faceState = getFaceReviewActionState({
    detection: {
      matchStatus: 'confirmed',
      matchedPersonId: 'person-rachel',
      autoMatchCandidatePersonId: null
    },
    matchedPerson: { id: 'person-rachel', displayName: 'Rachel' }
  });

  const rachelAction = getAssignmentActionState({
    faceState,
    person: { id: 'person-rachel', displayName: 'Rachel' }
  });
  const loriAction = getAssignmentActionState({
    faceState,
    person: { id: 'person-lori', displayName: 'Lori' }
  });

  assert.deepEqual(rachelAction, {
    isAlreadyAssigned: true,
    label: 'Assigned Rachel',
    disabled: true
  });
  assert.deepEqual(loriAction, {
    isAlreadyAssigned: false,
    label: 'Assign Lori',
    disabled: false
  });
});

test('example action is disabled and relabelled for existing assigned-person example', () => {
  const faceState = getFaceReviewActionState({
    detection: {
      matchStatus: 'confirmed',
      matchedPersonId: 'person-lori',
      autoMatchCandidatePersonId: null
    },
    matchedPerson: { id: 'person-lori', displayName: 'Lori' }
  });

  assert.deepEqual(
    getExampleActionState({
      faceState,
      detection: { id: 'face-1' },
      assignedPersonName: 'Lori',
      examples: [
        {
          personId: 'person-lori',
          faceDetectionId: 'face-1',
          status: 'active'
        }
      ]
    }),
    {
      alreadyExampleForAssignedPerson: true,
      canAddAssignedPersonAsExample: false,
      label: 'Added Lori As Example'
    }
  );
});

test('example completion is person-specific for reassignment correction', () => {
  const faceState = getFaceReviewActionState({
    detection: {
      matchStatus: 'confirmed',
      matchedPersonId: 'person-rachel',
      autoMatchCandidatePersonId: null
    },
    matchedPerson: { id: 'person-rachel', displayName: 'Rachel' }
  });

  assert.deepEqual(
    getExampleActionState({
      faceState,
      detection: { id: 'face-1' },
      assignedPersonName: 'Rachel',
      examples: [
        {
          personId: 'person-lori',
          faceDetectionId: 'face-1',
          status: 'active'
        }
      ]
    }),
    {
      alreadyExampleForAssignedPerson: false,
      canAddAssignedPersonAsExample: true,
      label: 'Add Rachel As Example'
    }
  );
});
