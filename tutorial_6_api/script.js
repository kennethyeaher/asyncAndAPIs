// keep fetched records separate from interface state.
let restaurants = [];
let isLoading = false;

/** enable array actions only when usable records are available. Returns nothing. */
function toggleMethodButtons(enabled) {
  for (const id of [
    'display-button',
    'filter-button',
    'map-button',
    'find-button',
    'restaurant-name',
  ]) {
    document.getElementById(id).disabled = !enabled;
  }
}

/** update the live request status from a state and message. Returns nothing. */
function updateStatus(state, message) {
  const status = document.getElementById('loading-status');
  status.className = `status-display ${state}`;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.querySelector('.status-message').textContent = message;
}

/** validate fetched records before display. Returns the array or throws an error. */
function validateRestaurants(records) {
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

/** fetch a JSON URL, validate records, and recover with retry. Returns a Promise<void>. */
async function loadData(url = 'restaurants.json') {
  if (isLoading) return;
  isLoading = true;
  restaurants = [];
  document.getElementById('directory').setAttribute('aria-busy', 'true');
  showEmptyState(
    'Loading the guide…',
    'Restaurant views will be available when the request finishes.',
  );
  document.getElementById('found-restaurant').textContent =
    'Waiting for restaurant data.';
  document.getElementById('result-count').textContent = 'Loading…';
  toggleMethodButtons(false);
  const loadButton = document.getElementById('load-data-button');
  const errorButton = document.getElementById('error-button');
  loadButton.disabled = true;
  errorButton.disabled = true;
  updateStatus('loading', 'Loading restaurants…');
  document.getElementById('view-description').textContent =
    'Views are unavailable while the guide loads.';

  // bound waiting time so a stalled request can always be retried.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let failureMessage =
    'Could not load restaurants. Check your connection, then try again.';
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      failureMessage =
        'The restaurant file is unavailable. Try again; if this continues, contact the page owner.';
      throw new Error(`Request failed with HTTP ${response.status}.`);
    }
    failureMessage =
      'The restaurant data could not be read. Try again; if this continues, contact the page owner.';
    const records = await response.json();
    restaurants = validateRestaurants(records);
    updateStatus(
      'success',
      restaurants.length
        ? `${restaurants.length} restaurants loaded.`
        : 'No restaurants are available. Try loading again later.',
    );
    toggleMethodButtons(restaurants.length > 0);
    displayAllRestaurants();
    document.getElementById('found-restaurant').textContent = restaurants.length
      ? 'Enter a full restaurant name to look it up.'
      : 'No restaurants are available to look up.';
    loadButton.textContent = 'Reload restaurants';
  } catch (error) {
    updateStatus(
      'error',
      error.name === 'AbortError'
        ? 'The request took too long. Try again.'
        : failureMessage,
    );
    loadButton.textContent = 'Retry loading restaurants';
    document.getElementById('view-description').textContent =
      'Views become available after a successful retry.';
    showEmptyState(
      'The guide could not load.',
      'Use “Retry loading restaurants” above to try again.',
    );
    document.getElementById('result-count').textContent = 'Data unavailable';
    document.getElementById('found-restaurant').textContent =
      'Name lookup is unavailable until the guide loads.';
  } finally {
    clearTimeout(timeout);
    isLoading = false;
    document.getElementById('directory').setAttribute('aria-busy', 'false');
    loadButton.disabled = false;
    errorButton.disabled = false;
  }
}

// native controls keep the loading action available without inline handlers.
document
  .getElementById('load-data-button')
  .addEventListener('click', () => loadData());
document
  .getElementById('error-button')
  .addEventListener('click', () => loadData('nonexistent-file.json'));

/** create a safe text element from its tag, content, and optional class. Returns an element. */
function createTextElement(tag, text, className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
}

/** render a record array into a target element using forEach. Returns nothing. */
function renderRestaurants(records, target) {
  target.replaceChildren();
  records.forEach((restaurant) => {
    const card = createTextElement('article', '', 'restaurant-card');
    card.append(
      createTextElement('p', restaurant.cuisine, 'cuisine'),
      createTextElement('h3', restaurant.name),
      createTextElement(
        'p',
        `${restaurant.neighborhood} · ${restaurant.priceRange} · ${restaurant.rating.toFixed(1)} / 5`,
        'restaurant-meta',
      ),
      createTextElement(
        'p',
        `${restaurant.hours} · ${restaurant.specialties.join(', ')}`,
      ),
      createTextElement('p', restaurant.phoneNumber, 'phone'),
    );
    target.append(card);
  });
  if (!records.length)
    target.append(
      createTextElement(
        'p',
        'No matching restaurants. Try another view.',
        'placeholder',
      ),
    );
}

/** show an empty state with a heading and guidance. Returns nothing. */
function showEmptyState(heading, message) {
  const panel = createTextElement('div', '', 'empty-state');
  panel.append(
    createTextElement('h3', heading),
    createTextElement('p', message),
  );
  document.getElementById('restaurant-list').replaceChildren(panel);
}

/** select a view and announce its record count and description. Returns nothing. */
function updateView(buttonId, count, description) {
  for (const id of ['display-button', 'filter-button', 'map-button']) {
    document
      .getElementById(id)
      .setAttribute('aria-pressed', String(id === buttonId));
  }
  document.getElementById('result-count').textContent =
    `${count} of ${restaurants.length} restaurants`;
  document.getElementById('view-description').textContent = description;
}

/** display every loaded restaurant with forEach. Returns nothing. */
function displayAllRestaurants() {
  updateView(
    'display-button',
    restaurants.length,
    'The full guide, with cuisine, neighborhood, price, and hours.',
  );
  renderRestaurants(restaurants, document.getElementById('restaurant-list'));
  if (!restaurants.length)
    showEmptyState(
      'The directory is empty.',
      'Try loading the guide again later.',
    );
}

/** filter loaded restaurants at one or two dollar signs. Returns nothing. */
function displayAffordableRestaurants() {
  const affordableRestaurants = restaurants.filter(
    (restaurant) => restaurant.priceRange.length <= 2,
  );
  updateView(
    'filter-button',
    affordableRestaurants.length,
    'A shorter list of restaurants priced at $ or $$.',
  );
  renderRestaurants(
    affordableRestaurants,
    document.getElementById('restaurant-list'),
  );
}

/** transform loaded records into names with map. Returns nothing. */
function displayRestaurantNames() {
  const names = restaurants.map((restaurant) => restaurant.name);
  updateView(
    'map-button',
    names.length,
    'Just the names, in the order they appear in the guide.',
  );
  const list = createTextElement('ol', '', 'name-list');
  names.forEach((name) => list.append(createTextElement('li', name)));
  document.getElementById('restaurant-list').replaceChildren(list);
}

/** find one loaded restaurant by its trimmed full name. Returns nothing; updates lookup feedback. */
function findRestaurant(event) {
  event.preventDefault();
  const query = document
    .getElementById('restaurant-name')
    .value.trim()
    .toLocaleLowerCase();
  const match = restaurants.find(
    (restaurant) => restaurant.name.toLocaleLowerCase() === query,
  );
  const target = document.getElementById('found-restaurant');
  if (!query) {
    target.textContent = 'Enter a restaurant name first.';
  } else if (match) {
    renderRestaurants([match], target);
  } else {
    target.textContent =
      'No restaurant has that name. Check the Names only view and try again.';
  }
}

// all array operations read the records produced by the async request.
document
  .getElementById('display-button')
  .addEventListener('click', displayAllRestaurants);
document
  .getElementById('filter-button')
  .addEventListener('click', displayAffordableRestaurants);
document
  .getElementById('map-button')
  .addEventListener('click', displayRestaurantNames);
document.getElementById('find-form').addEventListener('submit', findRestaurant);
