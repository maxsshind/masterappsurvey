# CoStar → Survey Pusher changelog

## 1.3.2 — 2026-09-10 — Yard included

Submitted to the Chrome Web Store on 2026-09-10: the single upload returned HTTP 200 / `SUCCESS`, the single publication request returned HTTP 200 / `OK`, and the post-publication draft read confirms 1.3.2. The public listing still showed 1.3.1 at 20:12 Arizona time, so public availability of 1.3.2 is not yet verified.

- Adds **Yard included: Unknown / Yes / No** to market comps. This describes yard with the offered space/site independently of property class. Yard size, fencing, security, access, permitted use, and differing sale/lease yard terms belong in Notes.
- New listings default Unknown (`null`); Yes saves `true`, No saves `false`. Existing values load when choosing Update this comp. Re-reading the same listing preserves manual choices; changing listings resets Unknown.
- An intentional change to Unknown can clear a saved answer. Untouched or omitted values never overwrite a known answer during an update. A failed save retains the answer and edit intent for retry.
- Adds the live `yard_included` column to duplicate lookup. The new Yard section stays discoverable with older hidden/collapsed/custom layouts without resetting preferences; its field remains movable with the existing editor.
- Retains the 1.3.1 schema fix. Survey `yard_area`, permissions, and hosts are unchanged.

Contract verified against live `public.comps.yard_included` (nullable boolean, default NULL) and Master App checkout `/Users/maxschumacher/Developer/master-app-matcher-codex-20260910` at `b8c08d8`. Legacy comp rows are not backfilled.

Verification: nine Node regression tests, including real request serialization for all tri-state transitions, and mounted browser tests using mocked Chrome messages. Browser coverage includes insert, existing-row hydration, re-read, duplicate re-selection, failure/retry, new-listing reset, custom field moves, and legacy layout visibility. No real comp records were written. See `tests/comp-schema.test.cjs` and `tests/yard-browser.js` for reproducible checks. Package validation and submission evidence are tracked in CHROMEWEBSTORE.md.

Release package: `masterappsurvey-v1.3.2.zip`. This release does not replace the local unpacked extension or resolve its cached-version mismatch described below.

## 1.3.1 — 2026-09-10 — Comp schema compatibility

Uploaded to the Chrome Web Store on 2026-09-10; upload returned `SUCCESS` and publication returned `OK`. The public listing subsequently verified **1.3.1**, updated September 10, 2026, before preparing 1.3.2.

Local installation attempted in Max's active Chrome profile using `local-extension/` with the existing extension's public key and ID. An initial runtime check reported 1.3.1, but after reload `chrome.runtime.getManifest().version` returned **1.3.0**, while the loaded manifest file returned 1.3.1 and the corrected lookup code remained present. **Installed-version mismatch remains unresolved; local replacement is not verified complete.** Sign-in and the unfinished 3439 S 40th St form/flyer were preserved and restored. `pendingCompUpgrade131` remains as a local-only draft backup in this extension's storage.

- Includes the July 28 fix (`6d1739e`) that stopped sending the removed `comps.type` field and split `PENDING` into `PENDING SALE` / `PENDING LEASE`. The existing 1.3.0 ZIP predates that fix, despite the source still being labeled 1.3.0.
- Removes the remaining `type` reference from duplicate-comp lookup queries. The old query failed silently, hiding possible existing comps.
- Keeps `status` as the saved field. Master App's Deal Type and Stage controls derive this status; there is no database `deal_type` column. The separate `sale_type` field describes Owner User / Investment / Sale Leaseback.
- Adds regression checks for all five on-market statuses, insert/update serialization, duplicate lookup, and the dropdown. Run `node --test tests/comp-schema.test.cjs`. Set `EXTENSION_ROOT` to an extracted ZIP directory to check the actual release contents.

Verification: all seven checks passed against source and the 1.3.1 ZIP; JavaScript syntax and archive integrity passed. All generated record fields and lookup columns were compared with the live schema. Read-only live REST requests returned HTTP 200 for the corrected lookup and HTTP 400 for the retired `type` lookup. Retained authentication, the running save payload, and authenticated lookup were verified; the installed runtime version remains inconsistent. No live comp records were inserted or updated; an end-to-end save remains unverified.

Evidence reviewed: [Comps Data Reference](</Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/max-playbook-and-knowledge/master-app/comps-data-reference.md>), [extension distribution guide](</Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/max-playbook-and-knowledge/master-app/surveys-reference.md>), and the July 28 type-retirement entry in [On-Market session log](/Users/maxschumacher/Developer/master-app/docs/ON_MARKET_PLAN.md). The session log explicitly recorded that the extension needed republishing. The older main-app CHANGELOG.md did not cover this migration.

Release package: `masterappsurvey-v1.3.1.zip`. The active local installation is `local-extension/`, a byte-matching copy of the package except for the public `key` added to preserve the store extension ID. Keep this folder available. This unpacked installation does not receive normal Web Store automatic updates; switch back through Chrome's normal store installation workflow after store rollout is verified, preserving local settings/drafts first. The existing `publish.sh` performs both upload and publication.
