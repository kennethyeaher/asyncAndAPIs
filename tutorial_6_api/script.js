// Keep fetched records separate from interface state.
let restaurants = [];
let isLoading = false;

/** Enable array actions only when usable records are available. Returns nothing. */
function toggleMethodButtons(enabled) {
  for (const id of ['display-button', 'filter-button', 'map-button']) {
    document.getElementById(id).disabled = !enabled;
  }
}

/** Update the live request status from a state and message. Returns nothing. */
function updateStatus(state, message) {
  const status = document.getElementById('loading-status');
  status.className = `status-display ${state}`;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.querySelector('.status-message').textContent = message;
}

/** Validate fetched records before display. Returns the array or throws an error. */
function validateRestaurants(records) {
  if (!Array.isArray(records)) throw new Error('Expected a restaurant array.');
  const ids = new Set();
  for (const restaurant of records) {
    if (!restaurant || !Number.isInteger(restaurant.id) || ids.has(restaurant.id)) {
      throw new Error('Restaurant identifiers must be unique integers.');
    }
    ids.add(restaurant.id);
    for (const field of ['name', 'cuisine', 'neighborhood', 'hours', 'phoneNumber']) {
      if (typeof restaurant[field] !== 'string' || !restaurant[field].trim()) {
        throw new Error(`Missing restaurant field: ${field}.`);
      }
    }
    if (!Number.isFinite(restaurant.rating) || restaurant.rating < 0 || restaurant.rating > 5 ||
        !['$', '$$', '$$$', '$$$$'].includes(restaurant.priceRange) ||
        !Array.isArray(restaurant.specialties) ||
        restaurant.specialties.some(specialty => typeof specialty !== 'string')) {
      throw new Error('Invalid restaurant details.');
    }
  }
  return records;
}

/** Fetch a JSON URL, validate records, and recover with retry. Returns a Promise<void>. */
async function loadData(url = 'restaurants.json') {
  if (isLoading) return;
  isLoading = true;
  restaurants = [];
  toggleMethodButtons(false);
  const loadButton = document.getElementById('load-data-button');
  const errorButton = document.getElementById('error-button');
  loadButton.disabled = true;
  errorButton.disabled = true;
  updateStatus('loading', 'Loading restaurants…');

  // Bound waiting time so a stalled request can always be retried.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`);
    const records = await response.json();
    restaurants = validateRestaurants(records);
    updateStatus('success', restaurants.length ? `${restaurants.length} restaurants loaded.` : 'No restaurants are available. Try loading again later.');
    toggleMethodButtons(restaurants.length > 0);
    loadButton.textContent = 'Reload restaurants';
  } catch (error) {
    updateStatus('error', error.name === 'AbortError' ? 'The request took too long. Try again.' : 'Could not load restaurants. Check your connection, then try again.');
    loadButton.textContent = 'Retry loading restaurants';
  } finally {
    clearTimeout(timeout);
    isLoading = false;
    loadButton.disabled = false;
    errorButton.disabled = false;
  }
}

// Native controls keep the loading action available without inline handlers.
document.getElementById('load-data-button').addEventListener('click', () => loadData());
document.getElementById('error-button').addEventListener('click', () => loadData('nonexistent-file.json'));

/** Create a safe text element from its tag, content, and optional class. Returns an element. */
function createTextElement(tag, text, className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
}

/** Render a record array into a target element using forEach. Returns nothing. */
function renderRestaurants(records, target) {
  target.replaceChildren();
  records.forEach(restaurant => {
    const card = createTextElement('article', '', 'restaurant-card');
    card.append(
      createTextElement('p', restaurant.cuisine, 'cuisine'),
      createTextElement('h3', restaurant.name),
      createTextElement('p', `${restaurant.neighborhood} · ${restaurant.priceRange} · ${restaurant.rating.toFixed(1)} / 5`),
      createTextElement('p', `${restaurant.hours} · ${restaurant.specialties.join(', ')}`),
      createTextElement('p', restaurant.phoneNumber),
    );
    target.append(card);
  });
  if (!records.length) target.append(createTextElement('p', 'No matching restaurants. Try another view.', 'placeholder'));
}

/** Display every loaded restaurant with forEach. Returns nothing. */
function displayAllRestaurants() {
  renderRestaurants(restaurants, document.getElementById('restaurant-list'));
}

/** Filter loaded restaurants at one or two dollar signs. Returns nothing. */
function displayAffordableRestaurants() {
  const affordableRestaurants = restaurants.filter(restaurant => restaurant.priceRange.length <= 2);
  renderRestaurants(affordableRestaurants, document.getElementById('filtered-list'));
}

/** Transform loaded records into names with map. Returns nothing. */
function displayRestaurantNames() {
  const names = restaurants.map(restaurant => restaurant.name);
  const list = document.getElementById('mapped-list');
  list.replaceChildren();
  names.forEach(name => list.append(createTextElement('p', name)));
}

// All array operations read the records produced by the async request.
document.getElementById('display-button').addEventListener('click', displayAllRestaurants);
document.getElementById('filter-button').addEventListener('click', displayAffordableRestaurants);
document.getElementById('map-button').addEventListener('click', displayRestaurantNames);
