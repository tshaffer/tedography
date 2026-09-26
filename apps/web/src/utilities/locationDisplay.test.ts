import assert from 'node:assert/strict';
import test from 'node:test';
import type { AlbumTreeNode, LocationDisplayMode } from '@tedography/domain';
import { formatLocationForDisplay, resolveAssetLocation } from './locationDisplay';

const garrapata = {
  placeName: 'Garrapata State Park',
  locationLabel: '34500 CA-1, Carmel, CA 93923, USA',
  city: 'Carmel',
  state: 'California',
  country: 'United States'
};

// An EXIF photo: reverse-geocoded city/state/country, GPSPosition string as its label.
const exifPhoto = {
  placeName: null,
  locationLabel: `36 deg 26' 1.20" N, 121 deg 55' 2.30" W`,
  city: 'Carmel',
  state: 'California',
  country: 'United States'
};

function album(id: string, locationDisplayMode: LocationDisplayMode | null): AlbumTreeNode {
  return {
    id,
    label: id,
    nodeType: 'Album',
    parentId: null,
    sortOrder: 0,
    locationDisplayMode,
    createdAt: '',
    updatedAt: ''
  };
}

test('each mode shows its own piece of the place', () => {
  assert.equal(formatLocationForDisplay(garrapata, 'placeName'), 'Garrapata State Park');
  assert.equal(formatLocationForDisplay(garrapata, 'placeNameAndCity'), 'Garrapata State Park, Carmel, California');
  assert.equal(formatLocationForDisplay(garrapata, 'address'), '34500 CA-1, Carmel, CA 93923, USA');
  assert.equal(formatLocationForDisplay(garrapata, 'cityStateCountry'), 'Carmel, California, United States');
});

test('a missing place name falls back to city/state/country, never coordinates', () => {
  assert.equal(formatLocationForDisplay(exifPhoto, 'placeName'), 'Carmel, California, United States');
  assert.equal(formatLocationForDisplay(exifPhoto, 'address'), 'Carmel, California, United States');
  assert.equal(formatLocationForDisplay({ locationLabel: exifPhoto.locationLabel }, 'address'), null);
});

test('place name and city does not repeat a place that is itself the city', () => {
  assert.equal(
    formatLocationForDisplay({ placeName: 'Carmel', city: 'Carmel', state: 'California' }, 'placeNameAndCity'),
    'Carmel, California'
  );
});

test('photo choice beats album choice beats global default', () => {
  const albums = new Map([
    ['a1', album('a1', 'address')],
    ['a2', album('a2', 'placeName')]
  ]);
  const photo = { ...garrapata, albumIds: ['a1', 'a2'], locationDisplayMode: null, customLocationLabel: null };

  assert.equal(resolveAssetLocation(photo, albums, null, 'cityStateCountry').text, garrapata.locationLabel);
  // The album being viewed wins over the photo's other albums.
  assert.equal(resolveAssetLocation(photo, albums, 'a2', 'cityStateCountry').text, 'Garrapata State Park');
  assert.equal(
    resolveAssetLocation({ ...photo, albumIds: [] }, albums, null, 'cityStateCountry').text,
    'Carmel, California, United States'
  );
  assert.equal(
    resolveAssetLocation({ ...photo, locationDisplayMode: 'cityStateCountry' }, albums, 'a2', 'placeName').text,
    'Carmel, California, United States'
  );
});

test('custom text is shown as-is, even with no place stored', () => {
  const resolved = resolveAssetLocation(
    { albumIds: [], locationDisplayMode: 'custom', customLocationLabel: "Grandma's back yard" },
    new Map(),
    null,
    'placeNameAndCity'
  );
  assert.deepEqual(resolved, { text: "Grandma's back yard", mode: null, isCustom: true });
});
