/** validate fetched records before display. Returns the array or throws an error. */
export function validateRestaurants(records) {
  if (!Array.isArray(records)) throw new Error('Expected a restaurant array.');
  const ids = new Set();
  for (const restaurant of records) {
    if (
      !restaurant ||
      !Number.isInteger(restaurant.id) ||
      ids.has(restaurant.id)
    ) {
      throw new Error('Restaurant identifiers must be unique integers.');
    }
    ids.add(restaurant.id);
    for (const field of [
      'name',
      'cuisine',
      'neighborhood',
      'hours',
      'phoneNumber',
    ]) {
      if (typeof restaurant[field] !== 'string' || !restaurant[field].trim()) {
        throw new Error(`Missing restaurant field: ${field}.`);
      }
    }
    if (
      !Number.isFinite(restaurant.rating) ||
      restaurant.rating < 0 ||
      restaurant.rating > 5 ||
      !['$', '$$', '$$$', '$$$$'].includes(restaurant.priceRange) ||
      !Array.isArray(restaurant.specialties) ||
      restaurant.specialties.some((specialty) => typeof specialty !== 'string')
    ) {
      throw new Error('Invalid restaurant details.');
    }
  }
  return records;
}

/** normalize search text, including accents and spacing. Returns a lowercase string. */
export function normalizeText(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
}

/** select and sort records from filters and favorite IDs without mutating the source. Returns an array. */
export function selectRestaurants(records, filters, favoriteIds = new Set()) {
  const query = normalizeText(filters.query);
  const selected = records.filter((restaurant) => {
    const searchableText = normalizeText(
      [
        restaurant.name,
        restaurant.cuisine,
        restaurant.neighborhood,
        ...restaurant.specialties,
      ].join(' '),
    );
    return (
      (!query || searchableText.includes(query)) &&
      (!filters.cuisine || restaurant.cuisine === filters.cuisine) &&
      (!filters.neighborhood ||
        restaurant.neighborhood === filters.neighborhood) &&
      (!filters.affordable || restaurant.priceRange.length <= 2) &&
      (!filters.favoritesOnly || favoriteIds.has(restaurant.id))
    );
  });
  if (filters.sort !== 'source') {
    selected.sort((first, second) => {
      if (filters.sort === 'rating')
        return (
          second.rating - first.rating ||
          first.name.localeCompare(second.name, 'en')
        );
      if (filters.sort === 'price')
        return (
          first.priceRange.length - second.priceRange.length ||
          second.rating - first.rating ||
          first.name.localeCompare(second.name, 'en')
        );
      return first.name.localeCompare(second.name, 'en');
    });
  }
  return selected;
}
