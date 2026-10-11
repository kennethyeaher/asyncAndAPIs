const STORAGE_KEY = 'table-finder.favorites.v1';

/** read a versioned favorite list from a supplied storage object. Returns IDs or null; throws for invalid data. */
export function readFavorites(storage) {
  const saved = storage.getItem(STORAGE_KEY);
  if (saved === null) return null;
  const record = JSON.parse(saved);
  if (
    !record ||
    record.version !== 1 ||
    !Array.isArray(record.ids) ||
    record.ids.length > 1000 ||
    record.ids.some((id) => !Number.isInteger(id)) ||
    new Set(record.ids).size !== record.ids.length
  ) {
    throw new Error('Saved favorites are invalid.');
  }
  return record.ids;
}

/** save integer favorite IDs to supplied storage. Returns nothing; storage failures propagate to the interface. */
export function writeFavorites(storage, ids) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ids: [...ids] }));
}

/** remove the saved favorite record from supplied storage. Returns nothing; storage failures propagate. */
export function removeFavorites(storage) {
  storage.removeItem(STORAGE_KEY);
}
