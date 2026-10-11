const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../tutorial_6_api/restaurants.json');
let model;
let store;
const defaults = {
  query: '',
  cuisine: '',
  neighborhood: '',
  sort: 'source',
  affordable: false,
  favoritesOnly: false,
};
before(async () => {
  model = await import('../tutorial_6_api/directory-model.js');
  store = await import('../tutorial_6_api/favorites-store.js');
});

// Model checks use fixed expectations rather than browser rendering details.
test('selection intersects search, area, price, and favorites', () => {
  const selected = model.selectRestaurants(
    fixture,
    {
      ...defaults,
      query: 'PHO',
      neighborhood: 'College Park',
      affordable: true,
      favoritesOnly: true,
    },
    new Set([5, 8]),
  );
  assert.deepEqual(
    selected.map((restaurant) => restaurant.id),
    [5],
  );
});
test('sort orders are deterministic and never mutate frozen source records', () => {
  const source = Object.freeze(
    fixture.map((restaurant) => Object.freeze({ ...restaurant })),
  );
  assert.deepEqual(
    model
      .selectRestaurants(source, { ...defaults, sort: 'price' })
      .map((restaurant) => restaurant.id),
    [5, 3, 1, 8, 6, 7, 2, 4],
  );
  assert.deepEqual(
    model
      .selectRestaurants(source, { ...defaults, sort: 'rating' })
      .map((restaurant) => restaurant.id),
    [4, 7, 1, 8, 5, 2, 6, 3],
  );
  assert.deepEqual(
    source.map((restaurant) => restaurant.id),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
});
test('normalized search handles accents, spaces, and dish names', () => {
  assert.equal(model.normalizeText('  CAFÉ  '), 'cafe');
  assert.deepEqual(
    model
      .selectRestaurants(fixture, { ...defaults, query: 'ramen' })
      .map((restaurant) => restaurant.id),
    [2],
  );
});
test('validation rejects out of range ratings and malformed specialties', () => {
  for (const patch of [
    { rating: 6 },
    { rating: -1 },
    { specialties: ['pho', 1] },
    { priceRange: 'free' },
  ]) {
    assert.throws(() =>
      model.validateRestaurants([{ ...fixture[0], ...patch }]),
    );
  }
  assert.deepEqual(model.validateRestaurants([]), []);
});

/** create an in memory Storage equivalent for persistence behavior checks. Returns a storage object. */
function createStorage() {
  const records = new Map();
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: (key) => records.delete(key),
  };
}
test('versioned favorites round trip and remove only their own entry', () => {
  const storage = createStorage();
  storage.setItem('unrelated', 'keep');
  assert.equal(store.readFavorites(storage), null);
  store.writeFavorites(storage, new Set([5, 8]));
  assert.deepEqual(store.readFavorites(storage), [5, 8]);
  store.removeFavorites(storage);
  assert.equal(store.readFavorites(storage), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
});
test('saved favorites reject unknown versions, duplicate IDs, and invalid types', () => {
  const storage = createStorage();
  for (const record of [
    { version: 2, ids: [5] },
    { version: 1, ids: [5, 5] },
    { version: 1, ids: ['5'] },
    { version: 1, ids: Array(1001).fill(1) },
  ]) {
    storage.setItem('table-finder.favorites.v1', JSON.stringify(record));
    assert.throws(() => store.readFavorites(storage));
  }
});
