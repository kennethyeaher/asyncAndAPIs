// browser evaluation callbacks use the globals provided by the loaded page.
/* global loadData, window, document, getComputedStyle */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname } = require('node:path');
const { chromium } = require('playwright');

const root = resolve(__dirname, '..');
const fixture = require('../tutorial_6_api/restaurants.json');
let browser;
let server;
let baseUrl;

/** serve only project files for browser tests. Returns a Promise<void>; sends 404 on read failure. */
async function serveProject(request, response) {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const filePath = resolve(
    root,
    `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`,
  );
  if (!filePath.startsWith(`${root}/`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const contents = await readFile(filePath);
    const types = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
    };
    response
      .writeHead(200, {
        'Content-Type': types[extname(filePath)] || 'application/octet-stream',
      })
      .end(contents);
  } catch {
    response.writeHead(404).end('Not found');
  }
}

// start a fresh server and browser; every test gets its own isolated context.
before(async () => {
  server = createServer(serveProject);
  await new Promise((resolveListening) =>
    server.listen(0, '127.0.0.1', resolveListening),
  );
  baseUrl = `http://127.0.0.1:${server.address().port}/tutorial_6_api/`;
  browser = await chromium.launch(
    process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {},
  );
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolveClosed) => server.close(resolveClosed));
});

/** open an isolated page and register cleanup with the test. Returns the page and runtime errors. */
async function openGuide(t, options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl);
  return { page, errors };
}

/** load the normal JSON fixture and wait for success. Returns a Promise<void>. */
async function loadGuide(page) {
  await page.locator('#load-data-button').click();
  await page.locator('#loading-status.success').waitFor();
}

/** assert that all actions requiring loaded records share one availability state. Returns a Promise<void>. */
async function assertAvailability(page, disabled) {
  for (const id of [
    'display-button',
    'filter-button',
    'map-button',
    'find-button',
    'restaurant-name',
  ]) {
    assert.equal(await page.locator(`#${id}`).isDisabled(), disabled, id);
  }
}

// verify the complete async sequence, including the waiting interval.
test('initial state explains loading and keeps data actions disabled', async (t) => {
  const { page, errors } = await openGuide(t);
  assert.equal(await page.title(), 'Table finder | Restaurant guide');
  assert.equal(new URL(page.url()).pathname, '/tutorial_6_api/');
  assert.match(await page.locator('h1').innerText(), /Find your/);
  await assertAvailability(page, true);
  assert.equal(await page.locator('#load-data-button').isEnabled(), true);
  assert.deepEqual(errors, []);
});

test('pending request shows feedback and prevents duplicate requests', async (t) => {
  const { page, errors } = await openGuide(t);
  let release;
  const waitForRelease = new Promise((resolveRequest) => {
    release = resolveRequest;
  });
  let requests = 0;
  await page.route('**/restaurants.json', async (route) => {
    requests += 1;
    await waitForRelease;
    await route.fulfill({ json: fixture });
  });
  await page.locator('#load-data-button').click();
  await page.locator('#loading-status.loading').waitFor();
  assert.equal(await page.locator('#load-data-button').isDisabled(), true);
  assert.equal(await page.locator('#error-button').isDisabled(), true);
  await assertAvailability(page, true);
  assert.equal(
    await page.locator('#directory').getAttribute('aria-busy'),
    'true',
  );
  await page.evaluate(() => loadData());
  release();
  await page.locator('#loading-status.success').waitFor();
  assert.equal(requests, 1);
  assert.equal(
    await page.locator('#directory').getAttribute('aria-busy'),
    'false',
  );
  await assertAvailability(page, false);
  assert.equal(await page.locator('#restaurant-list article').count(), 8);
  assert.deepEqual(errors, []);
});

test('all four array methods display expected records from the loaded file', async (t) => {
  const { page, errors } = await openGuide(t);
  await loadGuide(page);
  assert.deepEqual(
    await page.locator('#restaurant-list h3').allTextContents(),
    fixture.map((restaurant) => restaurant.name),
  );
  await page.locator('#filter-button').click();
  assert.deepEqual(
    await page.locator('#restaurant-list h3').allTextContents(),
    [
      "Milano's Italian Restaurant",
      'Border Café',
      'Pho Corner',
      'Tandoor Palace',
      'Seoul Kitchen',
    ],
  );
  assert.equal(
    await page.locator('#result-count').innerText(),
    '5 of 8 restaurants',
  );
  assert.equal(
    await page.locator('#filter-button').getAttribute('aria-pressed'),
    'true',
  );
  await page.locator('#map-button').click();
  assert.deepEqual(
    await page.locator('#restaurant-list li').allTextContents(),
    fixture.map((restaurant) => restaurant.name),
  );
  await page.locator('#restaurant-name').fill('  pHo CoRnEr  ');
  await page.locator('#find-button').click();
  assert.equal(
    await page.locator('#found-restaurant h3').innerText(),
    'Pho Corner',
  );
  await page.locator('#display-button').click();
  assert.equal(await page.locator('#restaurant-list article').count(), 8);
  assert.deepEqual(errors, []);
});

test('name lookup explains missing and whitespace only names', async (t) => {
  const { page } = await openGuide(t);
  await loadGuide(page);
  await page.locator('#restaurant-name').fill('No such restaurant');
  await page.locator('#find-button').click();
  assert.match(
    await page.locator('#found-restaurant').innerText(),
    /Check the Names only view/,
  );
  await page.locator('#restaurant-name').fill('   ');
  await page.locator('#find-button').click();
  assert.equal(
    await page.locator('#found-restaurant').innerText(),
    'Enter a restaurant name first.',
  );
});

// failure cases use real browser request interception, then retry the correct file.
for (const failure of [
  'HTTP 404',
  'HTTP 500',
  'network interruption',
  'malformed JSON',
  'invalid schema',
  'duplicate IDs',
]) {
  test(`${failure} disables browsing and recovers through retry`, async (t) => {
    const { page, errors } = await openGuide(t);
    await page.route('**/restaurants.json', async (route) => {
      if (failure.startsWith('HTTP'))
        await route.fulfill({
          status: Number(failure.slice(5)),
          body: 'Unavailable',
        });
      else if (failure === 'network interruption') await route.abort('failed');
      else if (failure === 'malformed JSON')
        await route.fulfill({ contentType: 'application/json', body: '{bad' });
      else if (failure === 'invalid schema')
        await route.fulfill({ json: [{ id: 1 }] });
      else await route.fulfill({ json: [fixture[0], fixture[0]] });
    });
    await page.locator('#load-data-button').click();
    await page.locator('#loading-status.error').waitFor();
    await assertAvailability(page, true);
    assert.equal(await page.locator('#restaurant-list article').count(), 0);
    assert.match(await page.locator('#load-data-button').innerText(), /Retry/);
    assert.equal(
      await page.locator('#directory').getAttribute('aria-busy'),
      'false',
    );
    await page.unroute('**/restaurants.json');
    await loadGuide(page);
    await assertAvailability(page, false);
    assert.equal(await page.locator('#restaurant-list article').count(), 8);
    assert.deepEqual(errors, []);
  });
}

test('stalled requests time out and allow retry', async (t) => {
  const { page } = await openGuide(t);
  await page.clock.install();
  let release;
  const pending = new Promise((resolveRequest) => {
    release = resolveRequest;
  });
  await page.route('**/restaurants.json', async (route) => {
    await pending;
    try {
      await route.abort();
    } catch (error) {
      // the abort signal can finish the intercepted request before cleanup.
      if (!error.message.includes('Route is already handled')) throw error;
    }
  });
  await page.locator('#load-data-button').click();
  await page.locator('#loading-status.loading').waitFor();
  await page.clock.fastForward(10001);
  await page.locator('#loading-status.error').waitFor();
  assert.match(
    await page.locator('.status-message').innerText(),
    /took too long/,
  );
  await assertAvailability(page, true);
  assert.equal(await page.locator('#load-data-button').isEnabled(), true);
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await loadGuide(page);
});

test('failed reload clears previous filtered and lookup results', async (t) => {
  const { page } = await openGuide(t);
  await loadGuide(page);
  await page.locator('#filter-button').click();
  await page.locator('#restaurant-name').fill('Pho Corner');
  await page.locator('#find-button').click();
  await page.locator('summary').click();
  await page.locator('#error-button').click();
  await page.locator('#loading-status.error').waitFor();
  assert.equal(await page.locator('article').count(), 0);
  await assertAvailability(page, true);
  await loadGuide(page);
  assert.equal(await page.locator('#restaurant-list article').count(), 8);
});

test('empty data and an empty affordable view give useful guidance', async (t) => {
  const { page } = await openGuide(t);
  await page.route('**/restaurants.json', (route) =>
    route.fulfill({ json: [] }),
  );
  await loadGuide(page);
  await assertAvailability(page, true);
  assert.match(
    await page.locator('#restaurant-list').innerText(),
    /directory is empty/,
  );
  await page.unroute('**/restaurants.json');
  await page.route('**/restaurants.json', (route) =>
    route.fulfill({ json: [fixture[1]] }),
  );
  await loadGuide(page);
  await page.locator('#filter-button').click();
  assert.match(
    await page.locator('#restaurant-list').innerText(),
    /No matching restaurants/,
  );
});

test('external names render as literal text in cards and name view', async (t) => {
  const { page, errors } = await openGuide(t);
  const name = '<img src=x onerror="window.injected=true">';
  await page.route('**/restaurants.json', (route) =>
    route.fulfill({ json: [{ ...fixture[0], name }] }),
  );
  await loadGuide(page);
  assert.equal(await page.locator('#restaurant-list h3').innerText(), name);
  assert.equal(await page.locator('#restaurant-list img').count(), 0);
  await page.locator('#map-button').click();
  assert.equal(await page.locator('#restaurant-list li').innerText(), name);
  assert.equal(await page.evaluate(() => window.injected), undefined);
  assert.deepEqual(errors, []);
});

test('keyboard controls, live statuses, and reduced motion remain usable', async (t) => {
  const { page } = await openGuide(t, { reducedMotion: 'reduce' });
  await page.locator('#load-data-button').focus();
  await page.keyboard.press('Enter');
  await page.locator('#loading-status.success').waitFor();
  await page.locator('#filter-button').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#restaurant-list article').count(), 5);
  assert.equal(
    await page.locator('#loading-status').getAttribute('role'),
    'status',
  );
  await page.evaluate(
    () =>
      (document.getElementById('loading-status').className =
        'status-display loading'),
  );
  assert.equal(
    await page
      .locator('.status-marker')
      .evaluate((element) => getComputedStyle(element).animationName),
    'none',
  );
});

test('layouts fit narrow and desktop widths with the test panel expanded', async (t) => {
  const { page } = await openGuide(t);
  await loadGuide(page);
  await page.locator('summary').click();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      `${width}px has no horizontal overflow`,
    );
    assert.equal(await page.locator('#load-data-button').isVisible(), true);
  }
});

test('without JavaScript the data file stays accessible', async (t) => {
  const { page } = await openGuide(t, { javaScriptEnabled: false });
  assert.match(
    await page.locator('noscript').innerText(),
    /open the restaurant data/,
  );
  const response = await page.request.get(
    new URL('restaurants.json', page.url()).href,
  );
  assert.equal(response.ok(), true);
  assert.equal((await response.json()).length, 8);
});
