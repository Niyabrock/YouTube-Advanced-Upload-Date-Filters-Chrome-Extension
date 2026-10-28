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

API results replace the visible native result items while an extra interval is active and are labeled accordingly. Clearing restores native items. The native filter panel, links, URL parameters, and listeners remain intact. Native `sp` filters and sorting cannot be mapped reliably without depending on an undocumented encoding, so **they are not applied in API mode**. The UI states this explicitly. API mode includes videos only, uses relevance sorting, and may differ from YouTube's personalized results. API pagination and result availability have Google's limits; no claim of exhaustive access is made.

The group detector uses desktop renderer names, known preset links, and an English heading fallback. Changed markup or unsupported localized layouts may prevent insertion; native functionality remains available. Styling inherits YouTube tokens, uses Roboto, supports dark mode, and keeps the expanded list in normal flow. Pixel accuracy across current YouTube variants has not been verified. No reference screenshots were provided.

The API key is kept in `chrome.storage.local`, restricted to trusted extension contexts, never sent to the page, and sent only by the service worker to `www.googleapis.com`. No analytics. Keys on a client device cannot be perfectly concealed. Use a dedicated project, API restrictions, monitoring, and quotas; do not use a server secret. HTTP referrer restrictions may not work with extension-origin requests. Each search/page normally costs 100 quota units. A typical 10,000-unit daily quota permits roughly 100 searches/pages. No credentials are included in the project.

Permissions: `storage` for the key, Google API host access for searches, and a content script matching desktop `www.youtube.com`. No tabs/history permission or extension popup.

API references: https://developers.google.com/youtube/v3/docs/search/list and https://developers.google.com/youtube/v3/determine_quota_cost

## Development and validation

- `npm test`: rolling dates and mocked service-worker API tests.
- `npm run build`: recreates `dist/` from the source without dependencies.
- `node tests/browser.mjs`: Chromium fixture integration. Requires Playwright resolvable as a package, or set `PLAYWRIGHT_MODULE` to its installed path. `CHROMIUM_PATH` overrides `/usr/bin/chromium`. The fixture mocks API messaging and native markup; it is not a live YouTube test.

Date tests cover all 18 intervals, month ends, leap years, year boundaries, timestamps, and invalid inputs. API tests verify query/bounds/pagination and missing-key/quota errors. Browser fixture checks injection, selection, safe rendering, reopen, navigation event, clear, and reinjection.

Live YouTube DOM inspection and authenticated API calls were unavailable in the build environment: no user API key was provided and outbound proxy access failed. Before release, load the unpacked extension in desktop Chrome with a configured key and verify actual native panel insertion, API pagination, native-filter transitions, back/forward, query changes, refresh, light/dark modes, narrow desktop layout, keyboard focus, and quota/key errors. The included fixture cannot establish production compatibility with YouTube's current UI.
