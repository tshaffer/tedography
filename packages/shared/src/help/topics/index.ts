import type { HelpTopic } from '../types.js';
import { gettingStarted } from './gettingStarted.js';
import { importingPhotos } from './importingPhotos.js';
import { reviewingPhotos } from './reviewingPhotos.js';
import { supportedFileFormats } from './supportedFileFormats.js';
import { viewingAndBrowsing } from './viewingAndBrowsing.js';
import { albumManagement } from './albumManagement.js';
import { keywords } from './keywords.js';
import { smartAlbums } from './smartAlbums.js';
import { location } from './location.js';
import { searching } from './searching.js';
import { photoAdjustments } from './photoAdjustments.js';
import { editQueue } from './editQueue.js';
import { sharingAndPrinting } from './sharingAndPrinting.js';
import { people } from './people.js';
import { peopleReviewAndMaintenance } from './peopleReviewAndMaintenance.js';
import { maintenance } from './maintenance.js';
import { usersAndPermissions } from './usersAndPermissions.js';
import { runningOnTheNetwork } from './runningOnTheNetwork.js';

export const helpTopics: HelpTopic[] = [
  gettingStarted,
  importingPhotos,
  supportedFileFormats,
  reviewingPhotos,
  viewingAndBrowsing,
  albumManagement,
  keywords,
  smartAlbums,
  location,
  searching,
  photoAdjustments,
  editQueue,
  sharingAndPrinting,
  people,
  peopleReviewAndMaintenance,
  maintenance,
  usersAndPermissions,
  runningOnTheNetwork,
];

/** Fixed display order for help categories in the browsable index. */
export const helpCategoryOrder: string[] = [
  'Basics',
  'Organizing',
  'Search',
  'Editing',
  'Sharing',
  'People',
  'Admin',
];
