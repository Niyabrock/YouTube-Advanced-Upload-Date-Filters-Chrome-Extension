# More YouTube Upload Dates — 1.0.3

Version 1.0.3 integrates the extra dates directly into YouTube’s native Upload Date column, matching the supplied five-column visual reference without replacing the filter panel. The separate More upload dates dropdown is removed. The native-results implementation from 1.0.2 is retained: date searches navigate to the normal `youtube.com/results` page, leaving YouTube to render videos, metadata, previews and continuation results.

**Important: native date search is experimental.** Live YouTube behavior has not been verified for this release. Earlier live access attempts returned proxy HTTP 403. The extension’s navigation and date calculations are tested, but YouTube’s recognition, inclusivity, timezone interpretation and completeness of `after:`/`before:` searches have **not** been verified. Extension options expose this limitation in their hover text. Do not treat this release as proof of accurate native date enforcement. Complete the live checks below before relying on it.

## Install or update on Mac

Use [more-youtube-upload-dates-1.0.3.zip](https://github.com/Niyabrock/YouTube-Advanced-Upload-Date-Filters-Chrome-Extension/raw/refs/heads/main/downloads/more-youtube-upload-dates-1.0.3.zip), extract it, and select the extracted folder containing `manifest.json` in Chrome’s **Load unpacked** dialog. No build or API key is needed for native searches.

For an existing installation, replace the contents of the existing unpacked extension directory with the new ZIP contents (or this repository’s `dist/` contents), keeping the same directory path. Open `chrome://extensions`, click **Reload**, confirm version **1.0.3**, and reload all open YouTube tabs. Keeping the same path retains the extension ID and its saved key. The key is unused by native search; Options still supports replacing/removing it for compatibility.

Source lives in `extension/`. `dist/` contains everything Chrome needs. A repository ZIP also works: extract it and Load unpacked from its **dist** directory.

## Controls and date definitions

These exact options appear in YouTube’s existing **Upload Date** column:

1. Today — original native link
2. This week — original native link
3. This month — original native link
4. Last 3 months — extension
5. Last 6 months — extension
6. This year — original native link
7. Last 2 years — extension
8. Last 3 years — extension
9. Last 5 years — extension

A subtle horizontal divider follows **Last 5 years**, then the existing **Custom date range** label appears as one ordinary option, with no forced line break or special wrapping. It expands labeled start/end date fields; both dates are intended to be included. Invalid/reversed dates and future end dates are rejected. **Clear date operators** appears only when the current query contains date operators, retaining other URL parameters and quoted literal date terms.

The original four native elements, links, listeners and selected state are preserved. Their behavior remains YouTube’s native filtering; only the five additional presets and custom ranges use the existing date-operator navigation. The extension inherits native row typography and spacing, uses YouTube theme variables, and leaves other columns and their widths unchanged. A legacy Last hour row, when present, is hidden while the integrated list is active to keep the requested nine presets. If all four recognizable native date rows are not yet present, insertion waits for YouTube to finish rendering rather than substituting a custom implementation for a native option. Dynamic updates repair the list without creating another dropdown or duplicate extension rows.

The unchanged date helper uses the computer’s **local** calendar (the four original native links continue to use YouTube’s own period definitions): Today starts at local midnight; This week starts Monday; This month starts on day 1; This year starts January 1. Each ends today. Rolling months/years subtract calendar months from today and clamp to the destination month’s last day, including February 29. No 30-day month approximation is used. Boundaries are calculated when clicked, not automatically refreshed later.

## Native search implementation and limits

For an intended inclusive range of January 1–31, the extension constructs:

```
https://www.youtube.com/results?search_query=bees+after%3A2026-01-01+before%3A2026-02-01
```

The start is passed as `after:YYYY-MM-DD`; the exclusive end is the next local calendar date passed as `before:YYYY-MM-DD`. This is the **intended** interval convention, not a verified assertion about YouTube’s interpretation. Date-only operators do not carry a timezone. YouTube may interpret the dates differently, ignore them, or change support. Boundary-day videos and local-midnight behavior require live validation. The extension does not claim a guaranteed timestamp-accurate native equivalent to Data API `publishedAfter`/`publishedBefore`.

Navigation uses a real same-origin YouTube results URL and a normal page load. YouTube owns rendering, scrolling, previews and native controls. The extension never creates native-looking fake cards, instantiates private YouTube components, hides loaded results, fabricates metadata, or replaces preview behavior. Native thumbnail hover behavior, view counts, relative dates, duration overlays, channel images/badges, captions and other labels remain whatever YouTube itself provides for that search/account/viewport. Their actual live behavior has not been tested here.

Original query terms and other URL parameters, including opaque native `sp` filters, are retained. Existing unquoted date operators are replaced when choosing another range; quoted literal date terms are retained. Native filters may intersect and narrow a date search: clear an existing native Upload date filter first when testing a wider range. The extension does not decode or rewrite YouTube’s undocumented `sp` protobuf to try to remove only one filter. It does not hide incompatible filters or promise every native-filter combination works.

There is **no remembered filter**: no date choice is written to Chrome storage, local/session storage, cookies, history state, or a custom URL flag. No previous selection is reapplied to a new search, on refresh, or on navigation. Old `upload_interval` flags are ignored/removed. The date terms are part of the current native **search query**, so refreshing or revisiting that exact search naturally retains its explicit terms, just as if they had been typed manually. The extension may display those terms and offer to clear them; it does not infer or restore a preset. A new query without date terms remains unfiltered.

## Why this approach

Version 1.0.1 used `search.list`, hid native result renderers, and built `.ud-card` HTML. API snippets do not include the complete private renderer data and interactive configuration used by YouTube’s preview components. Copying/constructing those internal components would be unsupported and cannot establish parity. Filtering only loaded native videos would produce incomplete results, so that approach is excluded. Rebuilding metadata and pretending an animated thumbnail is a native hover preview would also fail the objective.

Native operators are implemented as an explicitly experimental **Approach A**, pending live validation. Approach B has no established supported integration here; this is not proof that native integration is impossible. This release does not claim that every requested range can be enforced reliably by YouTube. The old background API handler, secure key-management Options and its tests remain for compatibility, but native controls do not invoke it or open a fallback results interface. No automatic fallback silently changes modes.

The content script uses a batched MutationObserver and navigation events solely to attach/reset controls. There is no polling, stored selection, native result observation/filtering loop, or API request for a native search.

## Development

Node 20+; no runtime or build dependencies:

```
npm test
npm run build
npm run package
```

Packaging uses only Node’s built-in modules, producing an installable ZIP with `manifest.json` at its root. The packaging command includes the README and all runtime files. No key or other credentials are packaged.

Browser fixture tests use Playwright and an installed Chromium:

```
PLAYWRIGHT_MODULE=/path/to/playwright npm run test:browser
```

Or install Playwright in a separate tools directory and supply its absolute package path. `CHROMIUM_PATH` overrides `/usr/bin/chromium`. Playwright is only a test tool; it is not bundled with the extension.

Unit tests cover preset order, local calendar periods, Monday/week transitions, month/year clamping, leap years, custom dates, invalid input, DST in America/New_York and Europe/London, and UTC offsets in Pacific/Kiritimati and Pacific/Honolulu. URL tests cover original queries, quoted literals, native parameters, replacement/clearing, and no inherited dates. Legacy background tests cover the API request/error path. Browser fixtures cover native-link navigation and all five extension presets, exact integrated ordering and divider position, absence of dropdowns, custom input/errors, browser navigation/history, untouched native DOM node identity/listeners/metadata, stable DOM updates, repeated panel reopening/reconstruction, unchanged other columns, matching native typography/spacing in both themes, keyboard focus/Escape, and no extension API requests or filter storage. **Fixtures do not test YouTube’s server, genuine previews, or operator accuracy.**

## Required live verification

Earlier live access attempts on October 29, 2026 returned HTTP 403 from the environment’s network proxy. This release was tested with intercepted browser fixtures, not the live site. No successful live date-operator test is claimed. An unpacked-registration smoke check for this release timed out without registering a service worker; the installed Chromium administrator policy contains `ExtensionInstallBlocklist: ["*"]`. Thus fixture script injection does not establish actual Chrome extension registration. On desktop Chrome with the unpacked extension:

- Compare ordinary `bees` results with a fixed historical date range and confirm YouTube treats the terms as constraints rather than plain text. Open sampled videos and inspect full publication dates, including both boundaries. Check several queries and paginated results; a few plausible matches cannot prove complete enforcement.
- Verify all calendar presets and rolling presets. Test Monday/Sunday, month/year changes, leap days, local midnight and a timezone differing from UTC. Check an intentionally empty or very narrow historical range and confirm no out-of-range videos appear. **If dates are ignored or boundaries differ, native date enforcement is unsupported for that case; do not report it as working.**
- Test custom same-day and multi-day ranges; confirm intended end-date inclusion and no neighboring-day leakage.
- Confirm genuine hover previews, overlays, durations, channels, views, badges, captions, shopping labels and infinite scrolling, where YouTube normally provides them.
- Verify normal query editing, native filters/sorts, clear, refresh, browser back/forward and new searches. Confirm a new search without date terms receives no old filter.
- Check panel reopening/reconstruction, keyboard access, light/dark mode and narrow desktop widths. DOM/localization changes can prevent control insertion; the normal native results should remain usable.

The outcome established by automated fixtures is **the integrated layout, native component preservation and correct local date/URL construction**. Pixel-exact matching on the live YouTube page, actual extension registration, genuine hover previews and infinite scrolling still require desktop verification against the supplied screenshot. Strict native upload-date enforcement remains a manual validation requirement.
