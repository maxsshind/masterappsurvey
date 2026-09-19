# Changelog

## Unreleased — September 18 Survey alignment review

- Requested pricing simplification: removed area-calculation helper, source callout, empty-total waiting message and monthly-confirmation checkbox/save gate. Normal Save accepts valid pricing; exact monthly prefill and numeric/source safeguards remain.

- Requested layout revision: Area → Monthly pricing → Availability/client Notes/Date. Saved layouts migrate to v3 with a separate prior-preferences backup; Comp layout and draft values remain intact.

- Follow-up rent fix: prefer the open CoStar Space Details over the property summary; prefill exact monthly rent and offered size for review, preserve existing/edited quotes, and retain separate drafts per selected space. Source/extracted checks: 167 unit tests and 41 browser scenarios. No installed or Store update.

- Linked editable monthly total, per-SF and per-acre rent; explicitly offered acreage;
  separate/included/unknown expenses; version-1 source metadata and exact decimal math.
- Strict complete-number entry, exact selected-space monthly prefill, legacy values and
  unknown choices preserved, minimal unrelated patches, coordinated area/rent writes.
- Deliberate suite selection, independent MT drafts and combined alternatives,
  stable-ID atomic saves, durable reviewed retries, stale-update review and account isolation.
- Compact tenancy/availability/lease/status choices; client notes below pricing; expandable
  Notes 2; private source evidence; persistent Save controls; neutral empty fields.
- Survey layout migration with exact prior backup and unchanged Comp preferences.
- Corrected inherited Survey `property_name` writes: the canonical Survey table has no
  such column. Comp's separate property name remains supported.
- Packaging separated from publication. Draft storage and retention disclosed locally.

This is a local implementation/review package; manifest remains the 1.3.3 baseline.
No Store, installation, production data, main-app schema or behavior changes.
See PROJECT.md for exact checks, artifacts and known boundaries.

# CoStar → Survey Pusher changelog

## 1.3.3 — 2026-09-10 — Property linking on save

**Submitted to the Chrome Web Store on 2026-09-10** after the main-app owner verified
the production save function and execution permissions. Exactly one upload returned
HTTP 200 / `SUCCESS`; the draft verified 1.3.3 before exactly one publication returned
HTTP 200 / `OK`; post-publication draft remains 1.3.3. Public Version field still **1.3.2** at 2026-09-10 21:23:40 Arizona; public availability of 1.3.3 remains unverified.
The active unpacked installation is untouched. Code and privacy changes were pushed
to `main` at `84fa2eb`, including the previously submitted 1.3.2 commit `ba55959`.

- Comp saves now use the same atomic property-and-deal save service as Master App.
  A confident address/alias match links the existing building/site; no match creates
  one on save; ambiguous results ask the user to choose. City/state and observed
  CoStar property ID are sent to the service. No eager property writes or raw comp
  insert/update fallback remain in the extension.
- Adds an always-visible property card with **Open Property**, explicit **Skip
  property link for now**, and **Unlinked** status. Cancel restores the prior choice,
  including after a rejected link replacement. Existing deal identity survives failed
  lookups, and updates send the original property ID for the server's conflict check.
- A possible existing deal is offered as a deliberate **Update this comp** or
  **Save a separate deal** decision. The latter still runs automatic building/site
  matching. A saved deal remains selected for subsequent updates; **New deal at this
  property** intentionally starts another deal under the same site.
- Adds Suite/unit, Portion of site, and Multi-tenant building controls. Untouched
  values do not change existing rows. Offered sizes stay on the deal; new property
  facts contain only the numeric CoStar ID observed in its URL. No site totals or
  coordinates are inferred, and yard is not inherited into another deal. Explicitly
  confirmed whole-site/single-tenant deals may initialize site totals through the
  shared save service; suite/portion totals remain separate. State is visible and
  missing CoStar state is no longer silently defaulted to Arizona.
- Stores the exact pending save request locally by signed-in email before dispatch.
  Retries, worker suspension, panel reopen, concurrent button clicks, and a lost
  response reuse the same request ID. An uncertain response locks that draft for
  safe retry. A confirmed validation/authorization rejection unlocks the draft;
  generic gateway/server failures never silently enable a new insert or skip.
- Permissions, hosts, sign-in method, and survey save behavior are unchanged.
  Privacy documentation now covers market comps, linked property records, layout
  preferences, and temporary pending-save recovery.

Validation: 22 Node checks, 13 mounted property-linking scenarios, and six existing
yard scenarios, all using synthetic/mock data and blocked external browser requests.
Browser checks cover all five listing statuses, R&G/external edits, canceled changes,
failed lookup/save, committed-but-lost response recovery, malformed response,
storage failure before dispatch, ambiguity, skip, suite/portion data, and 320/390px
widths with existing custom layouts. A further **40 real extension-to-PostgREST checks** passed on source and extracted
ZIP against a separate disposable database with the final main-app migration. These
use the actual form/request builders and session transport and confirm real alias
matching, ambiguity, concurrency, rollback, response-loss recovery, and refresh.
The fixture setup also passed the main app's 151 database assertions. No production business records were changed for testing.

Run `node --test tests/comp-schema.test.cjs tests/property-linking.test.cjs`.
Set `EXTENSION_ROOT` to an extracted package to verify those runtime files. Serve the
source/package at `http://127.0.0.1:8783` and run the two browser fixture files through
Playwright. Package and live dependency verification are tracked in CHROMEWEBSTORE.md.

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
