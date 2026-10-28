# More YouTube Upload Dates

Manifest V3 extension that adds **More upload dates** beneath YouTube's native Upload date filters. Includes 2–4 weeks, 2–12 months, and 2–5 years. No runtime libraries, popup, remote executable code, or build dependencies.

## Install

1. Run `npm run build` with Node 20 or later.
2. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this project's `dist` directory.
3. Open the extension's **Options**. In Google Cloud Console, enable **YouTube Data API v3**, create an API key, restrict it to YouTube Data API v3, and save it in Options.
4. Reload YouTube. Search, open **Filters**, expand **More upload dates**, and select an interval. Use **Load more** for additional API pages. Clear the interval to restore native results.

The extension must be reloaded in Chrome after rebuilding. Development sources are in `extension/`; `dist/` is an unpacked release folder.

## How filtering works

YouTube's native `sp` parameter encodes preset filters; it is not a documented arbitrary-date interface. This extension does not invent date codes or rely on undocumented `after:`/`before:` query syntax. It calls the documented YouTube Data API v3 `search.list` endpoint with `q`, `type=video`, `publishedAfter`, `publishedBefore`, `order=relevance`, and pagination tokens. These search the API's video index; they do not merely remove old items from the currently loaded native page.

Ranges end at the selection instant. Weeks subtract 7 UTC calendar days per week; months and years subtract calendar units and clamp to the destination month's final day. For example, February 29 minus three years becomes February 28. Time of day and milliseconds remain intact. UTC avoids daylight-saving arithmetic shifts. API boundaries follow Google's endpoint semantics. Pagination holds the initial timestamp fixed; selecting again or refreshing recomputes the rolling window.

The selection is recorded in `upload_interval` in the current URL, so refresh, history, and panel reopening preserve it. Query changes preserve the interval only if the new URL retains that parameter; otherwise native mode resumes. Native filter selections leave API mode. No background polling runs: a batched MutationObserver and YouTube navigation events reattach controls as needed.

## Honest limitations

API results replace the visible native result items while an extra interval is active and are labeled accordingly. Clearing restores native items. Native results stay hidden during loading, errors, and empty responses; API errors never leave unfiltered videos presented as a successful custom search. The native filter panel, links, URL parameters, and listeners remain intact. Native `sp` filters and sorting cannot be mapped reliably without depending on an undocumented encoding, so **they are not applied in API mode**. The UI states this explicitly. API mode includes videos only, uses relevance sorting, and may differ from YouTube's personalized results. API pagination and result availability have Google's limits; no claim of exhaustive access is made.

The group detector uses desktop renderer names, known preset links, and an English heading fallback. Changed markup or unsupported localized layouts may prevent insertion; native functionality remains available. Styling inherits YouTube tokens, uses Roboto, supports dark mode, and keeps the expanded list in normal flow. Pixel accuracy across current YouTube variants has not been verified. No reference screenshots were provided.

The API key is kept in `chrome.storage.local`, restricted to trusted extension contexts, never sent to the page, and sent only by the service worker to `www.googleapis.com`. No analytics. Keys on a client device cannot be perfectly concealed. Use a dedicated project, API restrictions, monitoring, and quotas; do not use a server secret. HTTP referrer restrictions may not work with extension-origin requests. Each search/page normally costs 100 quota units. A typical 10,000-unit daily quota permits roughly 100 searches/pages. No credentials are included in the project.

Permissions: `storage` for the key, Google API host access for searches, and a content script matching desktop `www.youtube.com`. No tabs/history permission or extension popup.

API references: https://developers.google.com/youtube/v3/docs/search/list and https://developers.google.com/youtube/v3/determine_quota_cost

## Development and validation

- `npm test`: rolling dates and mocked service-worker API tests.
- `npm run build`: recreates `dist/` from the source without dependencies.
- `npm run test:browser`: Chromium integration fixtures. Requires Playwright resolvable as a package, or set `PLAYWRIGHT_MODULE` to its installed path. `CHROMIUM_PATH` overrides `/usr/bin/chromium`. By default the test executes the actual background module in a VM and connects the browser content script through an explicit messaging bridge, with simulated API responses and YouTube markup. It is not a live YouTube test. Set `REAL_EXTENSION=1` to load the unpacked build through Chromium’s extension debugging API and use actual Chrome storage/messaging/service-worker registration. That mode requires a Chromium build and administrator policy permitting unpacked extensions; it is blocked in the current cloud environment.

Date tests cover all 18 intervals, month ends, leap years, year boundaries, timestamps, and invalid inputs. There are 12 date tests and 17 background/API tests. Browser fixtures cover all 18 interval clicks through the actual date/request/response code, multiple result layouts, fixed-time pagination, loading, quota/key/network/invalid-response errors, empty results, retries, disconnected messaging, missing replies, timeouts, native result suppression/restoration, nested filters, page reconstruction, late native inserts, query navigation, refresh, and stale responses. The missing-reply test accelerates only the 25-second UI timeout. Browser-level extension registration is a separate optional test, not established by the VM bridge.

Live YouTube DOM inspection and authenticated API calls were unavailable in the build environment: no user API key was provided and the network proxy denied live YouTube access with HTTP 403. Cloud Chromium also reports that loading unpacked extensions is disabled by administrator policy, so the real-extension test mode could not execute. The browser/VM integration suite passed; real Google responses and actual Chrome extension messaging remain unverified here. Before release, load the unpacked extension in desktop Chrome with a configured key and verify actual native panel insertion, API pagination, native-filter transitions, back/forward, query changes, refresh, light/dark modes, narrow desktop layout, keyboard focus, and quota/key errors. The included fixture cannot establish production compatibility with YouTube's current UI.


## 1.0.1 filtering fix

The original `mount()` used `ytd-search #contents ytd-section-list-renderer #contents`. This requires an extra `#contents` ancestor above the section-list renderer. When that ancestor is absent, the function returned silently **before** calling `search()`: click handlers and selection updates worked, but no background message or API request occurred. The original test fixture accidentally included that extra ancestor, hiding the bug. Running the new section-list fixture against 1.0.0 reproduces zero mounted result hosts and zero API requests.

Version 1.0.1 starts the request independently of that selector. It mounts a separate results section under the search primary column (with search-root/main fallbacks), hides native result renderers while preserving the filter controls, and shows a visible layout error if no host can be found. It keeps request state separate from DOM nodes, remounts cached results after YouTube replaces nodes, and suppresses late native result inserts. Changing intervals discards stale responses. Pagination retains the initial time boundary. Loading, empty results, worker disconnection/timeout, malformed responses, key restrictions, API enablement and quota errors are visible and retryable. Saving a key is still not treated as a successful API request. Returned video timestamps are validated against the requested range as a defensive check in addition to server-side API filtering.

### Update an existing installation on Mac

1. Download the latest repository ZIP from GitHub and extract it.
2. Replace the old unpacked extension directory’s contents with the new `dist/` contents **at the same path**. This preserves the extension ID and its locally saved key.
3. Open `chrome://extensions` and click the extension’s **Reload** button. Confirm version **1.0.1**.
4. **Reload every open YouTube tab** so Chrome replaces the old content scripts. Reloading only the extension leaves existing tabs with stale script contexts.
5. Search for bees, open Filters, and choose a custom interval. You should see “Searching YouTube…” followed by API results, an empty-result message, or an actionable error. If you load from a different folder or remove/reinstall, you may need to save the key again.
