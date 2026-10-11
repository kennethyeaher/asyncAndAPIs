<p align="center">
  <img src="docs/assets/banner.svg" alt="Table finder. Load the guide. Find your next table." width="100%">
</p>

<p align="center">
  <strong>An async JavaScript exercise with a complete request and recovery flow.</strong><br>
  Explore eight sample restaurants with combined filters, sorting, and a personal shortlist.
</p>

<p align="center">
  <img alt="HTML5" src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&amp;logo=html5&amp;logoColor=white">
  <img alt="CSS" src="https://img.shields.io/badge/CSS-663399?style=flat-square&amp;logo=css&amp;logoColor=white">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-B89B00?style=flat-square&amp;logo=javascript&amp;logoColor=white">
  <a href="https://kennethyeaher.github.io/asyncAndAPIs/tutorial_6_api/"><img alt="Live demo" src="https://img.shields.io/badge/demo-live-254dba?style=flat-square"></a>
  <img alt="No runtime dependencies" src="https://img.shields.io/badge/runtime_dependencies-0-254dba?style=flat-square">
  <a href="https://github.com/kennethyeaher/asyncAndAPIs/actions/workflows/browser-checks.yml"><img alt="Browser checks" src="https://img.shields.io/github/actions/workflow/status/kennethyeaher/asyncAndAPIs/browser-checks.yml?branch=main&amp;style=flat-square&amp;label=browser%20checks"></a>
</p>

<p align="center">
  <a href="https://kennethyeaher.github.io/asyncAndAPIs/tutorial_6_api/"><strong>Try the guide ↗</strong></a> &nbsp; · &nbsp;
  <a href="#the-interaction">The interaction</a> &nbsp; · &nbsp;
  <a href="#class-requirements">Class requirements</a> &nbsp; · &nbsp;
  <a href="#run-locally">Run locally</a> &nbsp; · &nbsp;
  <a href="#verification">Verification</a>
</p>

---

## The interaction

An INST630 Week 6 project built from the supplied `tutorial_6_api` starter. The exercise moves restaurant records out of JavaScript and into a JSON file requested over HTTP. The interface shows what is happening while that request runs, enables browsing after validation, and offers a retry when loading fails. The extended guide adds a complete discovery flow: search across names and dishes, combine cuisine and neighborhood filters, sort the results, and keep a favorite shortlist.

<img src="docs/assets/preview-desktop.png" alt="Desktop Table finder interface with eight loaded restaurant cards, three browsing views, and a name lookup form." width="100%">

<details>
<summary><strong>See the mobile layout and recovery state</strong></summary>
<br>
<p align="center"><img src="docs/assets/preview-mobile.png" alt="Mobile guide with stacked controls and five affordable sample restaurants." width="320"></p>
<img src="docs/assets/preview-error.png" alt="Failed request state with a message, retry button, disabled browsing, and cleared results." width="100%">
</details>

**The data is a course fixture.** These eight listings, ratings, prices, hours, and phone numbers are sample content from the starter, not current restaurant information. The page requests its own `restaurants.json`; it does not call a commercial restaurant API or send searches or favorites to another service. Searches are not persisted. Favorites stay in the current tab by default; the optional Remember favorites checkbox stores a versioned list of restaurant IDs in this browser. Turning it off removes that saved record when storage is available.

## Beyond the brief

| Extension                   | User behavior                                                                           | Engineering decision                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Combined discovery**      | Search names, cuisines, neighborhoods, and dishes; narrow results with multiple filters | A pure selection function composes filters against the fetched array, with normalized text for accents and capitalization    |
| **Predictable sorting**     | Order cards and names by rating, price range, name, or the original guide order         | Sorting works on a new array, preserves source order, and uses explicit tie rules                                            |
| **Favorite shortlist**      | Save a place from its card or lookup result, then browse Favorites                      | Shared favorite IDs keep both surfaces synchronized; keyboard focus is restored when a saved card disappears                 |
| **Optional persistence**    | Choose whether favorites should survive a reload                                        | Saving is off by default; version checks reject corrupt data, and blocked storage falls back to tab memory                   |
| **Reset with Undo**         | Clear filters and restore the previous query, view, and sort                            | One state snapshot is recoverable until the next filter or view change or data request                                       |
| **Independent model tests** | Keep the discovery logic verifiable without rendering the page                          | Browser modules separate data selection and storage from DOM updates; tests check fixed expectations and source immutability |

These extensions stay within the original HTML, CSS, and JavaScript approach. There is no framework, build step, account system, or runtime dependency.

## A short walkthrough

1. Choose **Load restaurants**. The request status changes to loading and the data controls stay disabled.
2. After the eight records load, browse **All restaurants** or **Affordable · $ / $$**. Five listings meet the affordable rule.
3. Choose **Names only** to see the same records transformed into a simple list.
4. Enter **Pho Corner** in the name lookup. Matching ignores capitalization and surrounding spaces.
5. Expand **Behind the guide** and choose **Test a failed request**. The missing file produces an error through the same workflow, clears results, and disables browsing.
6. Choose **Retry loading restaurants** to recover using the correct JSON file.
7. Search for **ramen**, combine cuisine and neighborhood choices, or sort by **Highest rated**. Filters apply to each view, including Names only and Favorites.
8. Save **Pho Corner**, then open **Favorites**. Enable **Remember favorites in this browser** only if you want that shortlist restored on your next visit.
9. Choose **Reset filters**, then **Undo reset**. Your previous query, view, and sorting return.

## Class requirements

| Requirement                                         | Implementation                                                                                                                | Visible result                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Load external JSON with `fetch()` and `async/await` | `loadData()` defaults to `restaurants.json`, awaits the response, checks `response.ok`, then awaits `response.json()`         | Eight records arrive through an HTTP request                                   |
| Loading state                                       | `updateStatus()`, `toggleMethodButtons()`, `isLoading`, and `aria-busy`                                                       | Status text and a spinner appear; duplicate requests and browsing are disabled |
| `forEach`                                           | `renderRestaurants()` creates safe DOM elements for each record                                                               | Restaurant cards with cuisine, price, rating, hours, and phone number          |
| `filter`                                            | `displayAffordableRestaurants()` selects the affordable view; `selectRestaurants()` uses `filter` to keep `$` or `$$` records | Five affordable restaurants from the supplied fixture                          |
| `map`                                               | `displayRestaurantNames()` selects the name view; `renderDirectory()` uses `map` on matching loaded records                   | An ordered list of restaurant names                                            |
| `find`                                              | `findRestaurant()` looks up one record by normalized full name                                                                | A matching card or guidance for a missing name                                 |
| Error recovery                                      | `try/catch/finally`, a retry action, and a ten second abort timeout                                                           | Errors remain beside the loading control; retry requests the correct file      |
| Enable and disable appropriately                    | Controls depend on validated, nonempty records                                                                                | Failed, pending, and empty requests leave data actions disabled                |

The assignment asks for at least three array methods; the interface uses all four. These methods operate on fetched records rather than a duplicate array embedded in the script.

## How the async flow works

`restaurants` holds the validated records and `isLoading` prevents overlapping requests. Both live at module scope so the named event handlers can share the current state without exposing globals. Filter state, favorite IDs, and a single undo snapshot also remain in the interface module. The response, parsed records, timeout, and abort controller stay local to `loadData()`; the pure model uses local variables for its filtered and sorted arrays. The original loaded array is never sorted in place.

```text
Ready
  → Disable data actions and show loading feedback
  → Fetch restaurants.json
  → Check the HTTP response
  → Parse JSON and validate the record shape
  → Display records and enable data actions

Any failed request or invalid data
  → Clear stale results
  → Explain the failure and keep data actions disabled
  → Offer retry using restaurants.json

Finally
  → Clear the timeout and restore request controls
```

A successful empty array is handled separately from a request failure. It shows an empty directory and leaves browsing disabled. Records must contain unique integer IDs, required text fields, a rating between 0 and 5, a supported price range, and an array of specialty strings. External text is inserted with `textContent`, so markup in a restaurant name is displayed as text.

## Run locally

The application uses plain HTML, CSS, and JavaScript. It needs a local HTTP server because `fetch()` cannot reliably load a JSON file from a `file://` URL.

From the repository root:

```sh
python3 -m http.server 8000
```

Open **[localhost:8000/tutorial_6_api/](http://localhost:8000/tutorial_6_api/)**. VS Code Live Server is another option. No installation or build is needed to use the interface.

For development checks, use Node.js 22.13 or later in the 22 release line, or Node.js 24 or newer:

```sh
npm ci
npx playwright install chromium
npm run check
npm test
```

To use an existing Chrome installation instead of downloading Chromium:

```sh
BROWSER_CHANNEL=chrome npm test
```

`npm run check` runs ESLint, Prettier, and JavaScript syntax checks. `npm run format` applies the configured formatting. Playwright, ESLint, and Prettier are development dependencies only, with exact versions recorded in the lockfile. Tests start and stop their own local server.

## Verification

The suite now contains 32 tests: 26 browser tests and six independent model and storage tests. All passed locally in Chrome; the hosted workflow runs the same suite with Chromium. The workflow runs on pushes and pull requests; the badge links to its latest result. The class criteria are retained in the original 17 browser tests; additional checks cover the extended discovery and shortlist flows.

| Coverage          | Cases                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Request lifecycle | Initial disabled state, a delayed request, loading feedback, duplicate request prevention, and successful display         |
| Array methods     | Eight full cards, five affordable cards, ordered names, successful lookup, missing names, and whitespace input            |
| Recovery          | HTTP 404 and 500, network interruption, malformed JSON, invalid records, duplicate IDs, timeout, and retry                |
| Data boundaries   | Empty source array, no affordable matches, stale result removal, and literal markup                                       |
| Interface         | Keyboard activation, live status attributes, reduced motion, and no horizontal overflow at 320, 375, 768, and 1440 pixels |
| Basic fallback    | A visible JavaScript notice and a working link to the JSON file with scripting disabled                                   |

The screenshots above are actual browser captures at 1440 and 375 pixels. Browser interception supplies the failure cases; it does not establish behavior under every real network condition. Automated checks do not establish full accessibility conformance.

### Live browser checks

Manual checks on the published guide were completed on October 11, 2026:

| Environment         | Result                       | Observed behavior                                                                                                                                                                                                                                                                |
| ------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safari 27.0.1       | PASS                         | Initial disabled controls, eight loaded cards, five affordable results, eight names, normalized Pho Corner lookup, ramen search, missing file error, cleared results, disabled data actions, and successful retry                                                                |
| Firefox 156.0       | PASS                         | The same core loading, array method, search, failure, and retry workflow                                                                                                                                                                                                         |
| VoiceOver in Safari | PASS for the listening check | With VoiceOver enabled, Tab focused the failure button and Space activated it. A live listener confirmed that the button name, file unavailable error, and eight restaurants loaded message after retry were clearly spoken. VoiceOver was restored to its original off setting. |

These are scoped manual checks, not the complete automated suite repeated in each browser. VoiceOver rotor navigation, a complete screen reader task flow, delayed loading announcements, and physical mobile devices remain unverified.

<details>
<summary><strong>Manual failure check</strong></summary>

1. Open browser developer tools and block requests to `restaurants.json`.
2. Choose **Load restaurants** or **Reload restaurants**.
3. Confirm that the error explains the failure, the result area is cleared, and browsing and lookup are disabled.
4. Remove the request block.
5. Choose **Retry loading restaurants** and confirm that eight records return.
6. Repeat with network throttling to inspect the loading state. A request stalled beyond ten seconds should offer another attempt.

The built in failure button requests `nonexistent-file.json`, demonstrating an HTTP failure. Blocking the real JSON request exercises network failure separately.

</details>

## Design decisions

The guide uses a compact loading panel beside the introduction, followed by a restaurant directory and a separate lookup form. Blue identifies actions and cuisine labels. Restaurant names use a serif face; controls use the system sans serif stack. The cards group the fields needed to compare places without adding images or external services. Search and filtering stay next to the result count. The shortlist adds a practical decision step, while optional saving and Undo make recovery explicit.

Two patterns from _Designing Interfaces: Patterns for Effective Interaction Design_, 3rd edition, by Jenifer Tidwell, Charles Brewer, and Aynne Valencia support the interaction:

- **Responsive Enabling**, supplied PDF page 364: controls become available after the action they depend on. Here, browsing and lookup require successfully loaded records.
- **Progressive Disclosure**, supplied PDF page 365: secondary information appears after a user asks for it. Here, the failure demonstration and implementation explanation sit inside **Behind the guide**.

The book's **Error Messages** pattern, supplied PDF pages 801–802, discusses keeping corrective guidance near the relevant controls. This project applies that principle to request failures by keeping the message and retry action together. That is an adaptation of the form pattern to network loading.

Page references use PDF positions rather than printed page numbers. The textbook PDF is not included in this repository.

## Project structure

```text
asyncAndAPIs/
├── tutorial_6_api/
│   ├── index.html              # guide structure and native controls
│   ├── style.css               # responsive layouts and request states
│   ├── script.js               # async workflow, interface state, and rendering
│   ├── directory-model.js      # validation and pure record selection
│   ├── favorites-store.js      # versioned browser storage operations
│   └── restaurants.json        # supplied course fixture
├── tests/restaurants.test.cjs   # 26 browser behavior and failure checks
├── tests/directory-model.test.cjs # six independent model and storage checks
├── docs/assets/                 # banner and actual interface screenshots
├── .github/workflows/           # browser checks and manual Pages deployment
├── eslint.config.mjs            # JavaScript lint rules
└── package.json                 # development commands and dependencies
```

## Source and submission

The starting HTML, CSS, JavaScript scaffold, and eight restaurant records come from the course's `tutorial_6_api` starter. The unchanged starter is preserved in the first commit. Subsequent commits record the loading workflow, array interactions, guide design, tests, and documentation as separate changes.

Assignment resources:

- [JavaScript.info: Fetch](https://javascript.info/fetch)
- [MDN: async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
- [MDN: await operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await)
- [JavaScript.info: Asynchronous operations](https://javascript.info/async)

**Live demo:** [Open Table finder](https://kennethyeaher.github.io/asyncAndAPIs/tutorial_6_api/). The manual deployment workflow packages only the restaurant guide and a root redirect.

**Submission link:** [kennethyeaher.github.io/asyncAndAPIs/tutorial_6_api/](https://kennethyeaher.github.io/asyncAndAPIs/tutorial_6_api/)

---

## Author

**Kenneth Yeaher**  
MS in Human Computer Interaction  
University of Maryland, College Park  
[![LinkedIn: Kenneth Yeaher](https://img.shields.io/badge/LinkedIn-Kenneth_Yeaher-0A66C2?style=flat)](https://www.linkedin.com/in/kennethyeaher/)

`JavaScript` · `Async Programming` · `Interaction Design` · `HTML and CSS`
