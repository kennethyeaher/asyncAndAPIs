import {
  validateRestaurants,
  normalizeText,
  selectRestaurants,
} from './directory-model.js';
import {
  readFavorites,
  writeFavorites,
  removeFavorites,
} from './favorites-store.js';

// keep fetched records separate from interface state.
let restaurants = [];
let isLoading = false;
let favoriteIds = new Set();
let shouldRememberFavorites = false;
let previousFilters = null;
let foundRestaurantId = null;
let currentView = 'all';
const defaultFilters = Object.freeze({
  query: '',
  cuisine: '',
  neighborhood: '',
  sort: 'source',
});
let filters = { ...defaultFilters };

/** enable array actions only when usable records are available. Returns nothing. */
function toggleMethodButtons(enabled) {
  for (const id of [
    'display-button',
    'filter-button',
    'map-button',
    'find-button',
    'restaurant-name',
    'search-restaurants',
    'cuisine-filter',
    'neighborhood-filter',
    'sort-restaurants',
    'favorites-button',
    'reset-filters',
    'remember-favorites',
  ]) {
    document.getElementById(id).disabled = !enabled;
  }
  document.getElementById('undo-filters').disabled =
    !enabled || !previousFilters;
}

/** update the live request status from a state and message. Returns nothing. */
function updateStatus(state, message) {
  const status = document.getElementById('loading-status');
  status.className = `status-display ${state}`;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.querySelector('.status-message').textContent = message;
}

/** fetch a JSON URL, validate records, and recover with retry. Returns a Promise<void>. */
async function loadData(url = 'restaurants.json') {
  if (isLoading) return;
  isLoading = true;
  restaurants = [];
  foundRestaurantId = null;
  previousFilters = null;
  document.getElementById('filter-feedback').textContent = '';
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
    filters = { ...defaultFilters };
    previousFilters = null;
    populateFilters();
    syncFilterControls();
    updateFavoriteCount();
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
    const saveButton = createTextElement(
      'button',
      favoriteIds.has(restaurant.id) ? '★ Saved' : '☆ Save',
      'favorite-button',
    );
    saveButton.type = 'button';
    saveButton.dataset.favoriteId = String(restaurant.id);
    saveButton.setAttribute(
      'aria-pressed',
      String(favoriteIds.has(restaurant.id)),
    );
    saveButton.setAttribute(
      'aria-label',
      `${favoriteIds.has(restaurant.id) ? 'Remove' : 'Save'} ${restaurant.name}${favoriteIds.has(restaurant.id) ? ' from favorites' : ' to favorites'}`,
    );
    card.append(saveButton);
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

/** select records from current filters and view. Returns a new array in the chosen order. */
function getVisibleRestaurants() {
  return selectRestaurants(
    restaurants,
    {
      ...filters,
      affordable: currentView === 'affordable',
      favoritesOnly: currentView === 'favorites',
    },
    favoriteIds,
  );
}

/** render the current view and announce its count. Returns nothing. */
function renderDirectory() {
  const visible = getVisibleRestaurants();
  const hasKnownFavorites = restaurants.some((restaurant) =>
    favoriteIds.has(restaurant.id),
  );
  const buttons = {
    all: 'display-button',
    affordable: 'filter-button',
    names: 'map-button',
    favorites: 'favorites-button',
  };
  for (const [view, id] of Object.entries(buttons)) {
    document
      .getElementById(id)
      .setAttribute('aria-pressed', String(view === currentView));
  }
  document.getElementById('result-count').textContent =
    `${visible.length} of ${restaurants.length} restaurants`;
  const descriptions = {
    all: 'Cuisine, neighborhood, price, and hours for each matching restaurant.',
    affordable: 'Matching restaurants priced at $ or $$.',
    names: 'The matching names, in your chosen order.',
    favorites: 'Your saved places, narrowed by any active filters.',
  };
  document.getElementById('view-description').textContent =
    descriptions[currentView];
  const target = document.getElementById('restaurant-list');
  if (!restaurants.length) {
    showEmptyState(
      'The directory is empty.',
      'Try loading the guide again later.',
    );
  } else if (!visible.length) {
    showEmptyState(
      currentView === 'favorites' && !hasKnownFavorites
        ? 'Your shortlist is waiting.'
        : 'No matching restaurants.',
      currentView === 'favorites' && !hasKnownFavorites
        ? 'Choose Save on a restaurant card to add it here.'
        : 'Change a filter or use Reset filters to see more places.',
    );
  } else if (currentView === 'names') {
    const names = visible.map((restaurant) => restaurant.name);
    const list = createTextElement('ol', '', 'name-list');
    names.forEach((name) => list.append(createTextElement('li', name)));
    target.replaceChildren(list);
  } else {
    renderRestaurants(visible, target);
  }
  document.getElementById('undo-filters').disabled =
    !restaurants.length || !previousFilters;
}

/** display all matching restaurants with forEach. Returns nothing. */
function displayAllRestaurants() {
  previousFilters = null;
  document.getElementById('filter-feedback').textContent = '';
  currentView = 'all';
  renderDirectory();
}

/** apply the affordable price filter to loaded records. Returns nothing. */
function displayAffordableRestaurants() {
  previousFilters = null;
  document.getElementById('filter-feedback').textContent = '';
  currentView = 'affordable';
  renderDirectory();
}

/** display matching record names using map. Returns nothing. */
function displayRestaurantNames() {
  previousFilters = null;
  document.getElementById('filter-feedback').textContent = '';
  currentView = 'names';
  renderDirectory();
}

/** display the local favorite shortlist. Returns nothing. */
function displayFavorites() {
  previousFilters = null;
  document.getElementById('filter-feedback').textContent = '';
  currentView = 'favorites';
  renderDirectory();
}

/** populate filter choices from fetched records with safe text. Returns nothing. */
function populateFilters() {
  for (const [id, field, label] of [
    ['cuisine-filter', 'cuisine', 'All cuisines'],
    ['neighborhood-filter', 'neighborhood', 'All neighborhoods'],
  ]) {
    const select = document.getElementById(id);
    const options = [
      ...new Set(restaurants.map((restaurant) => restaurant[field])),
    ].sort();
    const first = createTextElement('option', label);
    first.value = '';
    select.replaceChildren(first);
    options.forEach((text) => {
      const option = createTextElement('option', text);
      option.value = text;
      select.append(option);
    });
  }
}

/** mirror filter state in the native controls. Returns nothing. */
function syncFilterControls() {
  for (const [id, field] of [
    ['search-restaurants', 'query'],
    ['cuisine-filter', 'cuisine'],
    ['neighborhood-filter', 'neighborhood'],
    ['sort-restaurants', 'sort'],
  ])
    document.getElementById(id).value = filters[field];
}

/** read a changed filter and invalidate the previous undo snapshot. Returns nothing. */
function changeFilters() {
  filters = {
    query: document.getElementById('search-restaurants').value,
    cuisine: document.getElementById('cuisine-filter').value,
    neighborhood: document.getElementById('neighborhood-filter').value,
    sort: document.getElementById('sort-restaurants').value,
  };
  previousFilters = null;
  document.getElementById('filter-feedback').textContent = '';
  renderDirectory();
}

/** clear filters while retaining one recoverable snapshot. Returns nothing. */
function resetFilters() {
  previousFilters = { ...filters, view: currentView };
  filters = { ...defaultFilters };
  currentView = 'all';
  syncFilterControls();
  renderDirectory();
  document.getElementById('filter-feedback').textContent =
    'Filters reset. Undo is available until your next filter or view change.';
}

/** restore the most recent reset once. Returns nothing. */
function undoFilters() {
  if (!previousFilters) return;
  const { view, ...savedFilters } = previousFilters;
  filters = savedFilters;
  currentView = view;
  previousFilters = null;
  syncFilterControls();
  renderDirectory();
  document.getElementById('filter-feedback').textContent =
    'Previous filters restored.';
}

/** update the favorite count using only IDs in the loaded directory. Returns nothing. */
function updateFavoriteCount() {
  const count = restaurants.filter((restaurant) =>
    favoriteIds.has(restaurant.id),
  ).length;
  document.getElementById('favorites-button').textContent =
    `Favorites (${count})`;
}

/** persist favorites only after explicit opt in. Returns nothing; reports storage failures. */
function persistFavorites() {
  if (!shouldRememberFavorites) return;
  try {
    writeFavorites(window.localStorage, favoriteIds);
    document.getElementById('favorite-feedback').textContent =
      'Favorites saved in this browser.';
  } catch {
    shouldRememberFavorites = false;
    document.getElementById('remember-favorites').checked = false;
    document.getElementById('favorite-feedback').textContent =
      'Browser storage is unavailable. Favorites still work in this tab; existing saved data may remain.';
  }
}

/** change one favorite using delegated card events and restore keyboard focus. Returns nothing. */
function toggleFavorite(event) {
  const button = event.target.closest('button[data-favorite-id]');
  if (!button || isLoading || !restaurants.length) return;
  const id = Number(button.dataset.favoriteId);
  if (favoriteIds.has(id)) favoriteIds.delete(id);
  else favoriteIds.add(id);
  const keyboardFocus = document.activeElement === button;
  const wasRemembering = shouldRememberFavorites;
  persistFavorites();
  updateFavoriteCount();
  renderDirectory();
  if (foundRestaurantId !== null)
    renderRestaurants(
      restaurants.filter((restaurant) => restaurant.id === foundRestaurantId),
      document.getElementById('found-restaurant'),
    );
  if (keyboardFocus) {
    const replacement = document.querySelector(
      `${event.currentTarget.id === 'found-restaurant' ? '#found-restaurant' : '#restaurant-list'} button[data-favorite-id="${id}"]`,
    );
    (replacement || document.getElementById('favorites-button')).focus();
  }
  if (!wasRemembering)
    document.getElementById('favorite-feedback').textContent =
      'Favorites updated for this tab.';
}

/** enable saving or remove persisted favorites when opting out. Returns nothing; reports storage failures. */
function changeRememberFavorites() {
  shouldRememberFavorites =
    document.getElementById('remember-favorites').checked;
  if (shouldRememberFavorites) persistFavorites();
  else {
    try {
      removeFavorites(window.localStorage);
      document.getElementById('favorite-feedback').textContent =
        'Saved favorites removed. Current favorites remain in this tab.';
    } catch {
      document.getElementById('favorite-feedback').textContent =
        'Could not remove saved favorites from browser storage. Current favorites still work in this tab.';
    }
  }
}

/** restore validated favorites when a previous visit opted in. Returns nothing; corrupt or blocked storage remains recoverable. */
function restoreFavorites() {
  try {
    const saved = readFavorites(window.localStorage);
    if (saved !== null) {
      favoriteIds = new Set(saved);
      shouldRememberFavorites = true;
      document.getElementById('remember-favorites').checked = true;
      document.getElementById('favorite-feedback').textContent =
        'Saved favorites restored. Load the guide to see them.';
    }
  } catch {
    document.getElementById('favorite-feedback').textContent =
      'Saved favorites could not be read. You can still make a new shortlist in this tab.';
  }
}

/** find one loaded restaurant by its trimmed full name. Returns nothing; updates lookup feedback. */
function findRestaurant(event) {
  event.preventDefault();
  const query = normalizeText(document.getElementById('restaurant-name').value);
  const match = restaurants.find(
    (restaurant) => normalizeText(restaurant.name) === query,
  );
  const target = document.getElementById('found-restaurant');
  foundRestaurantId = match?.id ?? null;
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

// filters compose with every view while the class methods retain dedicated controls.
document
  .getElementById('favorites-button')
  .addEventListener('click', displayFavorites);
document
  .getElementById('search-restaurants')
  .addEventListener('input', changeFilters);
for (const id of ['cuisine-filter', 'neighborhood-filter', 'sort-restaurants'])
  document.getElementById(id).addEventListener('change', changeFilters);
document
  .getElementById('reset-filters')
  .addEventListener('click', resetFilters);
document.getElementById('undo-filters').addEventListener('click', undoFilters);
document
  .getElementById('restaurant-list')
  .addEventListener('click', toggleFavorite);
document
  .getElementById('found-restaurant')
  .addEventListener('click', toggleFavorite);
document
  .getElementById('remember-favorites')
  .addEventListener('change', changeRememberFavorites);
restoreFavorites();
