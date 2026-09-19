# Changelog

## 1.4.9 local candidate — 2026-09-18 — Offered-space safeguards and clean highlights

- Includes the full1.4.8 flyer feature and tested1.4.7 property updates.
- Sends Portion of site and Multi-tenant context with flyer analysis. An unnamed
  partial offering, or multi-tenant offering without explicit whole-property
  confirmation, requires a suite/space identity before analysis. Older analysis
  requests missing scope flags are rejected; use1.4.9 for the new button.
- Includes coordinator96327d: optional Sale Highlights/Notes stop at downstream
  CoStar sections. Transaction History, tenants, market/loan/traffic information
  cannot spill into notes. A legitimate 'Building 100% air-conditioned' bullet stays.
-1.4.8 artifacts are retained as historical local candidates;1.4.9 supersedes them.
  Installed files and open drafts remain unchanged. No Store submission.

## 1.4.8 local candidate — 2026-09-18 — Analyze flyer

- Comp footer adds **Analyze flyer** beside Flyer. Attach a PDF, analyze, review
  supported property details with source excerpts, then update selected form fields.
  Blank fields start selected; existing values need explicit selection to replace.
  Save comp remains the only record-save action. No facts are silently saved.
- Supports text/range clear height, loading, power, office SF, lease area, year built,
  Class A, heavy power, rail and truckwell/dock. Power specifications do not imply
  Heavy power. Accepted lease area has its own source and stops following defaults.
- Changed form/identity/flyer/account discards stale results. Invalid nonblank manual
  entries remain visible and unchecked for replacement. Source excerpts render as
  plain text. Errors preserve drafts and can be retried without automatic AI retries.
- Reuses the Master App authenticated flyer-review engine and its identity, scope,
  conflict and unknown-value guards. Adds host access to https://www.sshteam.app/*.
  On-demand analysis sends the stored flyer to Anthropic through Master App; the
  extension contains no AI-provider key. PRIVACY_POLICY.md discloses this processor.
- Includes the complete tested1.4.7 base: Power, grouped Yard/features, text heights,
  protected lease-area defaults, advertised office capture ignoring Property Mix,
  previous Sales/suite/shared-flyer behavior. No installed update or Store submission.

## 1.4.7 local candidate — 2026-09-18 — Property controls and source capture

- Yard is a native Yes/No/Unknown checkbox with the other four feature controls.
  Features sit beside Property type on wide panels and stack below it on narrow
  panels. Saved layout section/field IDs, moves, hidden states and drafts survive.
- Power keeps entered specifications as text (up to4,000characters), independently
  of Heavy power. Saves, lookup/readback, deliberate clears and pop-outs preserve it.
- Blank untouched available lease SF defaults from Building SF only for lease
  offerings without a selected suite and without either Multi-tenant or Portion
  of site set to Yes. Its badge identifies the building default. Only that automatic
  value follows building edits/toggles. Captured suite sizes, saved values, entered
  values and deliberate blanks are preserved; unrelated updates omit lease area.
- Building Location=Urban no longer ends fact capture early. Sale Highlights supply
  advertised office SF when no selected suite is open. CoStar Property Mix is
  completely excluded per Max's rule. The University fixture captures10,000officeSF,
  17ftclearheight and600Apower; the6,285PropertyMixallocation is never used or warned
  about. Ranges/invalid advertisedoffice stay unresolved. Suite scope stays isolated.
- Includes previous suite switching, building flyer reuse, asking-price capture
  and free-text clear-height ranges. PDF analysis is a separately owned follow-up.

Verified237unit/transport tests,74mounted scenarios,6actualpop-outs,12MV3suite/flyer
and8MV3property groups. The final extracted16-file package passes237units,8property,
5Sales andMV3smoke; all files match tested source andZIP. Disposable fixtures only,
zero external requests or business-record writes. Layout checked320/390/560/720px.
This is a LOCAL package, not a Store submission or verified installed release.
Read-only Chrome files showed1.4.5 at packaging; installed files/storage untouched.


## 1.4.6 local candidate — 2026-09-18 — Clear-height ranges and text

- Clear height accepts reviewed ranges and descriptions such as `22-24'`, retaining
  the entered wording in `comps.clear_height` (up to 200 characters, outer trim).
  A single explicit feet value can also populate the legacy numeric field; ranges
  and prose leave `clear_height_ft` null instead of inventing a scalar.
- Editing a height sends the text/numeric pair together. Clearing clears both;
  unrelated updates omit both. Older numeric records still display and pending
  numeric-only saves retry their exact original request. Existing height-field
  layout customizations and pop-out edits survive the new text control.
- Includes all1.4.5 property fields and prior suite/shared-flyer/Sales fixes.
  Uses the coordinated app's new nullable text column and paired save contract.
  No new permissions or hosts. Installed1.4.4 active draft stays untouched.

Verified locally: 228 unit/transport checks, 68 mounted scenarios including 12
property-field scenarios, 6 actual pop-outs and 5 real MV3 property-capture groups.
The range is exercised through source capture, manual entry, save, authoritative
readback, uncertain-response reload and pop-out. No production test records.

## 1.4.5 local candidate — 2026-09-18 — Property fields

- Comp adds clear height (decimal feet or feet/inches input), office SF, available
  lease SF, year built, loading (up to 4,000 characters), Class A, heavy power,
  rail access, and truckwell/dock access. Existing yard, suite, portion, multi-tenant,
  building/land size, pricing and contact controls remain. Survey retains its
  existing office, clear-height, loading and power fields.
- Native feature checkboxes distinguish Unknown, Yes and No; Clear restores Unknown.
  Saved values hydrate, unrelated edits preserve them, explicit clears send null,
  and confirmed office zero remains zero. Office/lease SF display commas. Invalid
  measurements, ambiguous ranges, invalid years and oversized loading block saving.
- Visible Building/Space Details facts prefill only within their source scope.
  Selected suites cannot borrow building office/loading totals. Divisible space
  needs manual portion review; power amperage and a nearby railroad do not confirm
  heavy power or rail access. Re-reading a different selected suite starts a clean
  Comp draft. Manual edits survive a same-source re-read and pending-save recovery.
- Property types match Master App: ISF, IOS, Class A, Class B, Vintage, Flex, Land,
  Cold Storage. Legacy Class C displays as Vintage, without rewriting untouched rows.
- Includes all 1.4.4 Sales capture and 1.4.3 suite/shared-flyer fixes. Permissions and
  hosts unchanged. Uses existing app columns plus the app owner's now-live nullable
  loading and has_truckwell_or_dock contract. No new extension-owned schema.

Verified: 222 unit/transport tests, 65 mounted scenarios (9 new fields, 13 Comp,
6 Yard, 37 Survey), 6 actual pop-outs, 12 MV3 suite/flyer groups, 5 Sales groups,
and 4 property-capture groups. Disposable profiles/fixtures only; zero external
requests or real record writes. 320px and 390px controls visually checked.
Final package adds comp-property-fields.js (16 runtime/icon files).

Installed Chrome was independently observed as 1.4.4, with an active unsaved flyer
change for 2434 S 10th St. Do not reload until that edit is saved or intentionally
canceled. This is a local tested package, not installed or submitted to the Store.

## 1.4.4 local candidate — 2026-09-18 — CoStar Sales view

- Sales Summary captures Listing Details → Asking Price; Sales Property captures
  Availabilities → For Sale → Price. Historical sold prices, market averages,
  price/SF-only quotes, ranges and withheld prices are not used as asking totals.
- Submarket reads the bullet-separated header or Location label. Summary supports
  Building Size. Manual Comp price/submarket edits survive re-read and section
  switches; separate listing IDs keep different offerings at one address apart.
  Listing slugs never become numeric CoStar property IDs for deduplication.
- Includes all 1.4.3 suite-switching and shared-building-flyer changes. No additional
  permission, host, schema, installation or Store publication.

Verified live page layouts read-only, then 206 unit/transport tests, 56 mounted
browser scenarios, 6 real pop-out scenarios, 12 actual MV3 suite/flyer groups and
5 actual MV3 Sales groups using disposable fixtures. Final extracted package also
passes Sales groups and MV3 smoke; its 15 files match source and ZIP byte for byte.
Fixed behavior in the user's authenticated installed extension remains unverified.

## 1.4.3 local candidate — 2026-09-18 — Follow suites and reuse a building flyer

Prepared and verified locally; installed extension and Store submission unchanged.

- Survey Push follows CoStar space arrows at the same URL after the visible details
  settle. Saved sources retain their exact row. Save rechecks the source and blocks
  a different suite; duplicate choices cannot update a differently labeled suite.
  Add current CoStar space works even when the existing row has unknown tenancy.
- The sticky title names the draft suite; the source line shows its captured suite.
  Explicit edits, clears, manual siblings, delayed reads, pop-out source and
  account/survey/view switches preserve their own state. Batch readback maps by ID.
- For MT offerings, Building flyer attaches once and new spaces at that building
  reuse the stored URL. Reuse flyer selects an existing same-building attachment
  without opening/downloading it. This space only permits a separate flyer or none.
  Replacing/removing a default never bulk-updates saved attachments. Defaults are
  local to the signed-in account and survey, survive restart/pop-out, and can be
  cleared without deleting uploaded files. Delayed uploads retain their original
  target and cannot overwrite a newer choice. Save waits for an active upload.
- Existing range capture and thousands separators remain. No new permissions,
  hosts, external recipients, server table or Comp behavior changes. Privacy text
  now documents visible-space monitoring and local building-flyer preferences.

Final ZIP verification: 196 unit/transport tests, 56 mounted browser scenarios,
6 real pop-out scenarios, 12 actual MV3 suite-switch/save groups, and MV3 smoke.
The combined Yard 3 to Suite 7 test saves two distinct rows with one flyer upload.
All tests use disposable fixtures; no production business records were changed.
Live authenticated fixed-runtime behavior remains unverified until installation.

## 1.4.2 candidate — 2026-09-18 — Keep captured suites and format SF

Prepared and tested locally; not uploaded, submitted, or installed by this effort.

- After saving one space and reading the next at the same CoStar property, the
  duplicate-choice **Add current CoStar space** retains the captured suite number,
  size, office SF, pricing, range metadata and reviewed edits. Previously it
  discarded those into a blank building-only draft; refresh restored that blank.
- Refresh recovers omitted capture fields from the exact source of legacy blank
  drafts. Explicitly entered/cleared fields and edited quotes remain untouched.
  The separate manual action is now labeled **+ Blank space**.
- Suite, total building, office, minimum, maximum and proposed SF display thousands
  commas on load and blur. Presentation does not rewrite stored values, round
  precision, accept malformed numbers or interpret free-text ranges.
- No Comp, permissions, hosts, production records or installed-profile changes.

## 1.4.1 candidate — 2026-09-18 — Divisible survey spaces

Prepared locally; not uploaded, submitted, installed, or publicly verified.

- The single open CoStar Space Details can carry an explicit divisible range into
  Survey minimum/maximum SF. Property summary smallest-to-total ranges and
  contiguous figures never create a divisible suite or combined option.
- Minimum, maximum and optional proposed SF are separate controls. The advertised
  range remains visible; linked monthly pricing uses only the proposed SF, even
  for a Single tenant entry. A monthly total is bound to that area; changing the
  proposed area clears total-based base rent and expenses for fresh entry.
- Source office/loading details are not allocated to a proposed portion. The
  existing private source evidence is retained; saved metadata, including optional
  feature-area certification, survives unrelated edits.
- Combine suites opens the survey in Master App for explicit member selection.
  Existing linked combinations remain readable; member-dependent fields and rent
  are edited in Master App. Notes remain editable. Older free-text combinations
  stay readable; new unlinked Combined drafts are rejected.
- No new permissions, hosts, analytics, recipients, or Comp capture changes.
  Install/distribution must follow the web/database rollout supporting space_option.

## 1.4.0 — 2026-09-18 — Survey workflow and pop-out

- Moved Attach open CoStar flyer (PDF) into the fixed bottom action bar, directly
  above Add to survey. It stays visible while scrolling and in pop-out mode.

- NNN defaults to Separate charge and shows expense inputs, including imported
  NNN offerings. No expense amount is assumed. Entered expenses calculate the
  all-in monthly rent; existing saved/unlinked quotes retain their numbers.

- Added a labeled Pop out button for a wider, resizable window. Survey drafts and
  unsaved Comp edits transfer before the original panel closes; opening failures
  retain the original form. Repeated clicks focus the existing pop-out.

- Requested pricing simplification: removed area-calculation helper, source callout, empty-total waiting message and monthly-confirmation checkbox/save gate. Normal Save accepts valid pricing; exact monthly prefill and numeric/source safeguards remain.

- Requested layout revision: Area → Monthly pricing → Availability/client Notes/Date. Saved layouts migrate to v3 with a separate prior-preferences backup; Comp layout and draft values remain intact.

- Follow-up rent fix: prefer the open CoStar Space Details over the property summary; prefill exact monthly rent and offered size for review, preserve existing/edited quotes, and retain separate drafts per selected space. Source/extracted checks: 167 unit tests and 41 browser scenarios. Included in the 1.4.0 release.

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

Uploaded and submitted 2026-09-18 at 18:08 MST: upload SUCCESS, draft 1.4.0,
publication OK. GitHub release commit f421c6b. Final extracted 1.4.0 package passes
167 unit tests, 43 browser scenarios, 6 pop-out scenarios and MV3 smoke.
No installed-extension replacement, production business-data test or main-app changes.
See PROJECT.md for current release status, artifacts and verification limits.

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
