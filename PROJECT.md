# Flyer analysis candidate1.4.8 — 2026-09-18 21:38 MST (America/Phoenix)

Task01a0b7db-a7e9-7651-8554-e51208268673; Codex isolated worktree
`/Users/maxschumacher/.codex/worktrees/extension-flyer-analysis/extension`, branch
`codex/extension-flyer-analysis`. Base1.4.7 owner commit4235323 merged intact.
Includes every1.4.7 source/Power/layout/lease-default fix plus Analyze flyer review.

Backend12d3178 deployed to https://www.sshteam.app/api/extension/flyer-analysis;
production unauthorized401 and extension preflight204 verified. Same app checkout
sibling `master-app` carries the full implementation/documentation proposal.
Model/signed-in installed-extension end-to-end behavior remains unverified; all
extension checks use disposable fixtures and zero production record writes.

Verified240 unit/transport tests,84 mounted browser scenarios (10 flyer), actual
MV3 worker transport and final extracted-package worker/smoke. Narrow320/390px
review screenshots in output/review/flyer-review-*.png. Other inherited tests
verified by release owner:6popouts,12suite groups,8property groups,5Sales groups.
This effort separately verified the6popouts on its1.4.6-based feature before merge.

Delivery `/Users/maxschumacher/Developer/chrome extensions/Master App Survey/masterappsurvey-v1.4.8.zip`
and sibling `output/review/space-extension-1.4.8`.18files match source/ZIP/folder.
113675bytes, SHA25693b78352ffbd512472fe88409a278aea52f78d4757e1bb7c8d84811d797c2c85.
No installed-file replacement/reload or Chrome Web Store submission. Preserve open
draft before any in-place upgrade; keep the existing extension ID/storage.

Shared documentation: playbook, ops index/month and existing Surveys wiki mirror
checked; live wiki unchecked. Proposed full batch is in sibling master-app
`docs/EXTENSION_FLYER_ANALYSIS.md`. Await user approval before shared writes.
Next: user saves/intentionally cancels active draft, then authorized in-place
upgrade and live flyer check. Shared-doc approval is separate from code delivery.

---

# 1.4.7 completed local package — 2026-09-18 21:36 MST

Owner/root, Codex isolatedworktree`/Users/maxschumacher/.codex/worktrees/survey-property-fields-20260918`,
branch`codex/survey-property-fields-20260918`, based9fa71b8. User followups read from
coordinating task01a0b7bd-bc4b-7041-8e52-e32965450063; that owner ownsapp/schema/SF/geocode.

Implemented and verified: Yard grouped with features besidePropertytype540px+,
stackednarrow; Power nullabletextmax4000 independentHeavyPower; protected/provenance-
tracked leaseSFbuildingdefault; advertisedofficecapture and completePropertyMix
exclusion; BuildingLocation=Urban prematureboundaryfixed.237units,74mounted,
6actualpopouts,12suite/flyerMV3,8propertyMV3 pass. Extracted finalpackage237units,
8propertygroups,5Salesgroups,MV3smoke pass. Source/ZIP/extracted16fileparityverified.
Evidenceoutput/review/features-*; screenshotfeatures-320/390/560/720.png.
No external requests or real-record writes in tests. Live power nullabletext and
HeavyPower bool schema independently queried; noour schema/data/pinwrites.

Deliveredcanonical`/Users/maxschumacher/Developer/chrome extensions/Master App Survey/masterappsurvey-v1.4.7.zip`
and`output/review/space-extension-1.4.7`;109,957bytes;SHA256
`0d9d7d30e8ec1894d5bddc3be209a4ab47cfa58dd8167bd02a796a7c2b091f28`.
Freshreadonly installedfiles show1.4.5IDoigefkpjdbpbablcmnejkoaclonnhggp,
Default/UnpackedExtensions/masterappsurvey-v1.4.5_klToDY. No installedreplace/reload
orStore submission. Preserveactivecapture. InstructionsinCHROMEWEBSTORE.md.

Next: sendfinalcodecommit to flyer task01a0b7db-a7e9-7651-8554-e51208268673 forits
1.4.8integration (PDFmodules/backend remainits responsibility). It hasleaseorigin
integrationready. Existing SalesmonitoralreadyPAUSED. Extension-onlysharedcandidate
reference/wiki updates stillpending thisturn under prior explicitauthorization;
no productionopsentry forlocaluninstalledpackage. Appowner ownssharedapp/SFdocs.

---

# Clear-height ranges — completed local 1.4.6 — 2026-09-18 21:16 MST

Max's direct follow-up in coordinated task `01a0b7bd-bc4b-7041-8e52-e32965450063`
was read: "we will often times enter clear height like this 22-24' so make sure it
isnt a hard number field". Parent owns the extension correction in Codex worktree
`/Users/maxschumacher/.codex/worktrees/survey-property-fields-20260918`, branch
`codex/survey-property-fields-20260918`, based on1.4.5 commit15033e3. App/schema/matcher
owner remains that coordinated task. No app edits or real-record test writes here.

1.4.6 supersedes1.4.5 for height entry. `clear_height` preserves reviewed ranges/
descriptions (max200, outer trim only). Single explicit feet values also populate
legacy `clear_height_ft`; ranges/prose leave that numeric field null. Edited height
patches both fields, clearing clears both, unrelated patches omit both. Legacy
numeric records hydrate and old numeric-only pending requests retry unchanged.
Stable layout key preserves prior custom placement; pop-out retains exact text.
App owner deployed migration20260919041254, reporting71 SQL assertions. Independently
verified live nullable text/numeric columns and atomic save text support.

Verification: **228 units**, **68 mounted scenarios** (12property,13Comp,6Yard,37Survey),
**6 actual pop-outs**, **5 MV3 property-capture groups** including exact22-24' DOM ->
save -> readback. Final extracted1.4.6 reran228units,5property groups,5Sales groups
and actualMV3smoke. All pass, zero external requests. Prior12suite/flyer runtime
regressions passed for1.4.5; those modules unchanged. Screenshot checks320/390px.
Evidence: `output/review/height-text-*`. Package all16files match source/ZIP/folder.

Delivered ZIP: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey/masterappsurvey-v1.4.6.zip`
Extracted: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey/output/review/space-extension-1.4.6`
108,696bytes; SHA256 `dec2a91bff04e9639b83687b536cc7ea5ad98fcbb6404f7ee1c3035bdba1a88a`.

Extension-only shared Surveys reference, Comps data reference section and existing
`https://www.sshteam.app/wiki/surveys`/OneDrive wiki mirror updated under prior explicit
approval. Wiki/mirror MD5 `2b27b0f52db897bab0823b5cf6936ffe`. No separate production ops
event for a local package; app owner owns the schema/web release documentation.

Installed1.4.4 ID `pnoophcbdjbdnpknbidojhiiecfmghhj` and active unsaved2434S10thflyer
remain untouched. No Store submission. After Max saves/cancels the edit, reverify
installed path/ID, back up runtime and replace files in place from1.4.6, then Reload
same extensioncard. Detailed steps in CHROMEWEBSTORE.md. Do not remove/reinstall.

New separate task `01a0b7db-a7e9-7651-8554-e51208268673` owns PDF analysis button/route.
It must branch from this final1.4.6 code, not15033e3. No PDF-analysis edits belong here.
Both task owners receive final commit/artifacts; this scoped correction is complete
except deferred installed reload needed to preserve Max's active edit.

---

# Property fields extension — 2026-09-18 21:05 MST

Completed local **1.4.5** candidate in Codex worktree
`/Users/maxschumacher/.codex/worktrees/survey-property-fields-20260918`, branch
`codex/survey-property-fields-20260918`, base `f207c3e` (verified 1.4.4).
Parent task `01a0b71e-3d1a-7b80-bbc2-bfad6a26985a` owns extension only; coordinated
app/SF owner `01a0b7bd-bc4b-7041-8e52-e32965450063` independently reviewed the package.
Max's direct property-fields request there was read and confirmed. Existing earlier
user authorization "proceed with making the preview live and update playbook, ops
log, and wikis" covers these extension-specific documentation updates.

Comp adds clear height, office SF, available lease SF, year built, loading, Class A,
heavy power, rail and truckwell/dock access. Native checkboxes preserve unknown,
false and true; saved fields hydrate and intentional edits alone patch values,
including null clears. Numeric units validated; SF formatted with commas. Selected
suite facts cannot borrow building office/loading totals; divisible portions need
review. Comp re-read of another suite resets the prior offering. Canonical property
types match app; legacy Class C displays as Vintage without rewriting untouched rows.
Existing Survey schema/controls, suite safeguards and building-flyer reuse retained.
Backend new nullable loading (4000 chars)/dock columns independently read and verified.
App owner owns app/SF code, releases and their broader documentation proposal.

Verified source: **222 units, 65 mounted scenarios** (9 new fields, 13 Comp, 6 Yard,
37 Survey), **6 real pop-outs, 12 MV3 suite/flyer, 5 Sales, 4 property-capture groups**.
No external requests or production test records. 320px/390px controls visually
checked; final layout compact and reachable. Extracted delivered 1.4.5 independently
passes all222 units,4 property-capture groups and actual MV3 smoke. All16 runtime/icon
files match source, ZIP and delivered folder. Evidence `output/review/property-fields-*`.

Delivery: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey/masterappsurvey-v1.4.5.zip`
Extracted: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey/output/review/space-extension-1.4.5`
108,389 bytes; SHA256 `d22eb38fc67c8b7b7534f69e92e71373b0e4a4a3f47c1bd35dfe1e98b0847080`.
Canonical runtime/unrelated source edits preserved; no Store upload or publication.

Shared docs saved and verified: Surveys reference and Comps data reference in
`/Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/max-playbook-and-knowledge/master-app/`;
existing `https://www.sshteam.app/wiki/surveys` and mirror
`/Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/wiki/surveys.md`.
Live wiki and mirror MD5 `5c171af8cd0abfd4b182f2d8edb8a232` match. Ops index and September
archive checked; local package is not a production event. App owner handles app/SF
ops documentation separately. Sales monitor remains paused after completed review.

**Outstanding installation:** Chrome read-only AX inspection showed active unsaved
flyer change for **2434 S 10th St**. Existing installed runtime is **1.4.4**, ID
`pnoophcbdjbdnpknbidojhiiecfmghhj`, path
`/Users/maxschumacher/Library/Application Support/Google/Chrome/Default/UnpackedExtensions/masterappsurvey-v1.4.4_W1NaYy`.
No reload or replacement attempted. Next: after Max saves or intentionally cancels
that draft, verify current installed identity/path again, back up its runtime,
replace only runtime files from the verified1.4.5 folder in place, then Reload the
same extension card in chrome://extensions. Do not remove/reinstall or clear storage.
Verify1.4.5 on the card and actual property controls without writing test records.

---

## Independent parent review — 2026-09-18 20:39 MST

Parent task `01a0b71e-3d1a-7b80-bbc2-bfad6a26985a` reviewed final runtime diff and
independently reran all **206 unit/transport tests** and **5 actual MV3 Sales groups**
against the delivered 1.4.4 folder. All passed; no external requests. Verified all
15 source/ZIP/extracted files and recorded hash match. Earlier suite/flyer regression
evidence was inspected; shared-flyer module is unchanged from tested 1.4.3.
Evidence: `output/review/parent-review-1.4.4-{unit.txt,runtime.json}`.
Updated shared Surveys and Comps data references and existing Surveys wiki candidate
note under prior approval; wiki/mirror MD5 `2ef26d0bf98ba7428e81e9c64b32f2e7` verified.
Ops index/month checked; no production event for this local-only package. Monitor
`monitor-costar-sales-view-fix` paused after verified completion. Installed extension,
Store status and active user draft unchanged. A separate new property-fields effort
will start from this verified commit, coordinated with task
`01a0b7bd-bc4b-7041-8e52-e32965450063`; no remaining Sales-fix work.

# Sales-view capture — 2026-09-18 20:36 MST (America/Phoenix)

Local **1.4.4** candidate prepared in Codex worktree
`/Users/maxschumacher/.codex/worktrees/survey-sales-view-20260918`, branch
`codex/survey-sales-view-20260918`, based on combined 1.4.3 commit `afa2faf`.
Canonical delivery: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey`.
Original canonical edits and installed extension were not touched.

Verified user Sales listing Summary and Property layouts live with read-only DOM
inspection in a temporary Chrome tab (closed afterward): asking **$4,309,000**,
**Tempe Southwest**, building **17,236 SF**. Property also displays a historical
**$575,000** sold price, which must not populate asking. Sales Summary uses Listing
Details / Asking Price; Property uses Availabilities / For Sale / Price. Submarket
uses a bullet-separated header and a Location label. Capture now supports both.

Current implementation and checks are in CHANGELOG.md and
`tests/sales-view-runtime.cjs`. 206 units, 56 mounted scenarios, 6 real popouts,
12 actual MV3 suite/flyer groups and 5 actual MV3 Sales groups pass. Fixtures use
an isolated browser and synthetic save transport, zero external requests. Final
extracted runtime is checked separately with Sales groups and MV3 smoke. All15
runtime/icon files match source/ZIP/extracted. Existing 1.4.3 behavior is preserved.

Delivery: `masterappsurvey-v1.4.4.zip` (103,752 bytes), extracted at
`output/review/space-extension-1.4.4` under canonical delivery directory.
SHA256: `792b8663cc085efa3ca8f0673a9a0b86d2a2d94c5737a445a08b2bdadfa11c61`.
Evidence: this checkout `output/review/sales-{unit.txt,browser.json,popout.json,suite.json,runtime.json,delivered-runtime.json,mv3.json,package.json,delivery.json}`.

Shared documentation check: Surveys and Comp playbook references, production ops
index/September archive and existing Surveys wiki mirror read. No production ops
entry applies to this uninstalled build. Parent release owner retains live-wiki
integration. Proposed candidate note: "Local 1.4.4 includes 1.4.3 and supports the
Sales Summary/Property asking price and submarket layouts. Historical sold prices
are excluded. It is locally tested and not installed or submitted to the Store."
Shared save status remains pending coordination with parent; no shared writes here.

Next step: preserve the open draft, update the existing unpacked extension in place
and reload under a separately authorized installation step, retaining its ID/local
storage. Then verify the actual authenticated Sales listing without saving a test
record. No reload, installed-file replacement, Store submission or business-record
write occurred here. Parent coordinating task: `01a0b71e-3d1a-7b80-bbc2-bfad6a26985a`.

---

# Combined suite switching and shared flyers — 2026-09-18 20:22 MST (America/Phoenix)

Current outcome: local **1.4.3** package complete and delivered. Parent handled
flyers as Max requested; separate task handled suite switching. This checkpoint
supersedes the older candidate records below. Installed extension is unchanged.

- Codex local parent task `01a0b71e-3d1a-7b80-bbc2-bfad6a26985a`.
- Working checkout: `/Users/maxschumacher/.codex/worktrees/survey-shared-flyers-20260918`,
  branch `codex/survey-shared-flyers-20260918`.
- Canonical project/delivery: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey`.
  Canonical source edits and user's installed 1.4.2 profile were not overwritten.
- Flyer implementation `cebdb7f`; real pop-out verification `7d77573`; suite task
  commit `ddfd00f` integrated as `92de144`, with both upload and save-source guards.
- Attach Building flyer once for an MT building; new spaces reuse its URL.
  Reuse flyer selects a saved building attachment without opening/uploading it.
  This space only preserves an individual override/removal. Future defaults do
  not rewrite saved rows. Account/survey identity, restart/pop-out and delayed
  uploads are covered. Uploaded files are not deleted when detaching a link.
- Same-URL space arrows now refresh the selected capture automatically. Save checks
  the visible source; wrong-suite updates are blocked. See CHANGELOG.md for details.

Delivered ZIP: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey/masterappsurvey-v1.4.3.zip`.
Extracted folder: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey/output/review/space-extension-1.4.3`.
**102,941 bytes**, SHA-256 `1b852fd3571b92f4e546e2e4f8c195385783681e5a7bb64ddc085a5e1ec915a0`.
All 15 runtime/icon files match source, archive and delivered folder byte for byte.

Final extracted-package verification: **196 unit/transport tests**, **56 mounted
browser scenarios** (37 Survey, 6 Yard, 13 Comp), **6 actual Chrome pop-out scenarios**,
**12 real MV3 suite-switch groups**, and MV3 worker/panel smoke pass. A real extension
handler with fixture PDF/storage transport attaches once; DOM arrow moves Yard 3
into Suite 7; the real save pipeline creates separate rows sharing that flyer.
Wrong-source save and delayed rendering produce zero writes. Disposable profiles,
fixture Supabase only, no external requests. Narrow 320px screenshot visually
inspected; 390/560/720px checks also pass. Test browsers/loopback server closed.
Evidence in `output/review/combined-{package.json,delivery.json,unit.txt,browser.json,popout.json,mv3.json,suite.json}`.
Screenshot: `output/review/combined-popout/panel-320.png`.

Documentation completed under Max's existing authorization: local changelog,
release guide, privacy text, this checkpoint; shared Surveys playbook and existing
Surveys wiki candidate note. Live wiki row and mirror verified identical MD5
`9949c70b0b601d32e6c76a1a52378880`. Production ops index/September archive checked;
no new production event is appropriate for an uninstalled local package.

Next step: update files of the existing unpacked extension and reload that same
extension after preserving the active draft. Keep its ID/storage; do not install
a duplicate expecting old drafts to transfer. Current known installed path:
`/Users/maxschumacher/Library/Application Support/Google/Chrome/Default/UnpackedExtensions/masterappsurvey-v1.4.2_u70oHn`.
No automatic replacement/reload, Store upload/publication, main-app change, or
production business-record test was performed. Fixed behavior in Max's authenticated
CoStar session remains unverified until the installed version is updated.

---

# Suite-switch/save-target fix — 2026-09-18 20:17:57 MST (America/Phoenix)

Current scoped task: fix automatic same-URL CoStar space switching and prevent
wrong-row saves. Parent task `01a0b71e-3d1a-7b80-bbc2-bfad6a26985a` explicitly
retained flyer ownership and combined packaging. This task commits suite changes
only; no flyer implementation, version bump, Store upload, installation/reload,
production record write, or main-app change.

- Codex local task `01a0b799-7d27-7ef1-a174-885198f89df1`, saved Developer project;
  actual extension commands ran in `/Users/maxschumacher/.codex/worktrees/survey-extension-space-options-20260918`,
  branch `codex/survey-space-options-20260918`, base `d3656ed`.
- Canonical source: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey`.
  Parent flyer checkout: `/Users/maxschumacher/.codex/worktrees/survey-shared-flyers-20260918`.
- Live Chrome AX inspection reproduced Suite 7 (1,200 SF/100 office SF/$1,680/mo)
  opposite the Yard 3 update editor. One explicit Refresh correctly captured Suite 7
  but offered Update Yard 3 and no Add-current choice because saved tenancy was not
  MT. No Save was clicked. Drafts were persisted by the existing refresh handler.
- Verified installed extension ID `ecogfeklnlgikamdkdomndedgfegbpha`, version 1.4.2,
  path `/Users/maxschumacher/Library/Application Support/Google/Chrome/Default/UnpackedExtensions/masterappsurvey-v1.4.2_u70oHn`.
  Installed path/manifest read only; native Chrome used because extension side panel
  requires the existing Chrome session. DevTools connection was unavailable.
- Root causes: URL-only navigation detection ignores space arrows; saved result
  discarded source; duplicate update choice did not compare suite labels; Add-current
  depended on an existing MT row. Async read completion lacked view/scope/identity
  guards and batch alias mapping assumed database return order.
- Fix: visible DOM stability reads, same-URL polling, ordinal-before-body delay guard,
  pinned pop-out source and explicit ambiguity/closed-tab errors, save preflight,
  matching suite/building targets, source retention, ID-based readback mapping,
  independent manual siblings, edited legacy aliases and labels, stale account/survey/
  view response rejection. Sticky title names the edited suite; source line identifies
  the captured suite. Comp retains its previous tab fallback behavior.

Verified against final source:
- **189 unit/transport tests**; **50 mounted scenarios** (31 Survey, 6 Yard, 13 Comp).
- **6 real Chrome pop-out scenarios**, including storage/account/handoff protections.
- **12 end-to-end suite-switch groups** in a disposable actual MV3 extension profile:
  real worker DOM scraper, panel and save/recovery pipeline; only Supabase transport
  replaced with in-memory fixtures. Covers Yard 3 to Suite 7 insert, null-tenancy
  Add-current, delayed/back/forward arrows, 3.5-second mid-render Save rejection,
  repeated refresh/clears, restart, multi-tab/popup, wrong legacy alias, manual sibling,
  reversed database readback, deliberately edited saved label, and delayed responses
  after account/survey/Settings/Browse/Comp changes. Zero browser errors or external
  requests. Baseline 1.4.2 reproduced the original same-URL stuck-target bug.
- Layout tested at 320/390/720px; 390px screenshot visually inspected. Actual live
  CoStar fixed-runtime verification remains unperformed because installed extension
  and user's open work were deliberately not replaced. No production rows were used.

Evidence under this worktree's `output/review/`:
`suite-switch-unit.txt`, `suite-switch-browser.json`, `suite-switch-popout.json`,
`suite-switch-runtime.json`, `suite-switch-baseline.json`, `suite-switch-390.png`
(and 320/720 variants). Runtime test source: `tests/suite-switch-runtime.cjs`.
Independent reviewer findings were verified and fixed, then exercised by regressions.

Next step: parent cherry-picks this suite commit into its flyer checkout, resolves
panel overlap while retaining source/ID/save guards, reruns combined tests, and owns
release version/docs/package. Parent has been told to update privacy wording for
rendered-space polling while Survey Push is open. Shared playbook and existing wiki
were read for independent-space constraints; production ops log requires no local-only
release entry. Parent owns combined documentation completion under existing approval.
No Store/public status is newly asserted. Current manifest intentionally stays 1.4.2
until parent chooses the combined candidate number. Do not replace Max's installed
folder or clear his local extension storage during integration.

---

# Captured-suite follow-up — 2026-09-18 19:50:48 MST (America/Phoenix)

Current task: Max reported missing next-suite details after refresh and requested
comma-separated SF. Both are fixed in local candidate **1.4.2**. This supersedes
1.4.1 as the current review package; the prior checkpoints below remain historical.

- Codex local worktree: `/Users/maxschumacher/.codex/worktrees/survey-extension-space-options-20260918`, branch `codex/survey-space-options-20260918`.
- Canonical project: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey`.
  Older Developer/masterappsurvey paths were retired by the folder migration;
  do not recreate them. Canonical runtime files and installed extension untouched.
- Root cause verified: duplicate-choice Add available space called the manual
  blank-sibling constructor and aliased refresh to that empty draft. The new
  **Add current CoStar space** retains the reviewed capture and its source key.
  Refresh repairs omitted legacy fields from their exact archived capture while
  preserving explicit edits/clears and separately edited pricing. Manual creation
  is clearly labeled **+ Blank space**.
- Suite/building/office and min/max/proposed SF now display commas on load/blur;
  no formatting events rewrite drafts or round quantities. Existing range text,
  strict validation, draft isolation, retries and Comp behavior remain intact.
- Exact Curry Road fixture: save Yard 3; refresh Suite 7; add retains 1,200 SF,
  office 100 SF and $1,680/month; save creates one new row with the first unchanged.
  Reread/reload retain deliberate clears and never turn the saved source into a
  duplicate insertion. Screenshot text parsing distinguishes both suite identities.

Verification of the final extracted ZIP: **184 unit/transport tests**, **50 browser
scenarios** (31 Survey, 6 Yard, 13 Comp), and actual **MV3 worker/panel smoke** pass.
Synthetic fixtures only, zero external requests/production record writes. SF
screenshot at 390px visually checked; existing suite scenarios cover 320/390/560
and range scenarios cover 320/390/720px. Pop-out-specific tests were not rerun for
this change; their previous results below are historical.
Evidence: `output/review/suite-capture-{unit-package.txt,browser-package.json,extension-package.json,package.json,delivery.json}`.
Screenshot: `output/review/comma-sf-390.png`.

Delivered ZIP: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey/masterappsurvey-v1.4.2.zip`.
Extracted folder: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey/output/review/space-extension-1.4.2`.
All 14 runtime/icon files match source and archive. ZIP **97,860 bytes**, SHA-256
`7c132d75aef9730e6e2465ba2740707de2fd0bd4f395291507a2fe9680e77927`.
No upload, Store submission, installation/reload or main-app changes this follow-up.

Using the fixed version: **Add to survey** and wait for the saved confirmation;
move to the next CoStar space with its arrow; click extension **refresh**; if the
building already has a saved space, choose **Add current CoStar space**; review and
save. **+ Blank space** deliberately starts manual entry and does not save the
current draft. The CoStar modal arrows alone do not refresh the extension.

Local CHANGELOG.md and CHROMEWEBSTORE.md updated. Shared playbook Surveys
reference, September ops archive, and existing Surveys wiki mirror checked;
this remains a local candidate, so no new production ops event or shared live
behavior claim is needed. Prior web release documentation remains in place.
Next step: update the existing unpacked extension folder with the candidate files
and reload that same extension after Max is ready; retain its ID/local storage.
Do not load a second copy expecting the old drafts to transfer. Max's current
open draft was deliberately left untouched. Store/public rollout remains separate.

---

# Divisible space extension candidate — 2026-09-18 19:10:20 MST (America/Phoenix)

Current scope: support the approved Master App suite-range model and keep combined
suite relationships owned by the app's explicit member picker. User authorized
making the preview live and updating documentation. Parent Codex task owns web/
database rollout and extension release; this subtask performed no push, upload,
Store submission, installation/reload or production-record write.

- Isolated worktree: `/Users/maxschumacher/.codex/worktrees/survey-extension-space-options-20260918`
- Canonical source remains `/Users/maxschumacher/Developer/chrome extensions/Master App Survey`.
- Branch: `codex/survey-space-options-20260918`; base `bc543fd` (1.4.0 submission checkpoint).
- Parent checkout's existing AGENTS.md, PROJECT.md and STORE_LISTING.md edits were
  not changed. Preserve them when integrating this branch.
- Candidate manifest: **1.4.1**, not publicly/installed verified. Check current Store
  draft and public state before any release; do not blindly reuse its number.

Implemented: selected Space Details captures an explicit min/max range into
`space_option`, separate optional proposed SF, area-bound total rent/expenses,
minimal patches preserving existing metadata/feedback, strict numeric boundaries,
no allocated office/loading or guessed pricing. Ranges shown only in property
summary/contiguity never become suite metadata. Combine action opens the actual
survey in Master App; saved linked options allow notes-only changes here and
member-dependent edits there. Legacy free-text combinations remain readable;
new unlinked Combined drafts are blocked. Comp capture/save remains unchanged.

**Deployment dependency satisfied — 2026-09-18 19:23 MST:** parent verified the production column, triggers and actual web flows through main-app commit `c007f7a`. Candidate remains local; no Store submission or installation by this effort. Next distribution step: verify current Store draft/public status, preserve any pending review, then coordinate the separate extension rollout. Contract:
`{kind,min,max,proposed,members,review,quoteArea}`, with optional `featuresArea`
preserved but never filled from capture. Ranges use canonical whole-SF strings,
empty proposed/quoteArea initially and advertised `suite_size` text. No backfill
or auto-inference is part of this extension change.

Prepared ZIP: `output/masterappsurvey-v1.4.1.zip` — **96,919 bytes**; SHA-256
`08508a0a41667eb9cff1f5a40d212315e8fc35c0292d766d7fff2f5c3b14ca3c`.
Extracted folder: `output/review/space-extension-1.4.1`.
All 14 runtime/icon files match source and ZIP; no credentials/tests/docs in ZIP.

Verification: **181 unit/transport tests** pass in source and extracted ZIP.
The final package passes **46 mounted browser scenarios** (27 Survey, 6 Yard,
13 Comp property linking), **6 real Chrome pop-out scenarios**, and MV3 worker/
panel smoke. Disposable fixture profiles only; remote requests blocked. Verified
range capture → insert, save/reopen, notes-only update, quote invalidation and
320/390/720px range layout; source Office SF retained privately without allocation.
Evidence: `output/review/space-{unit-source.txt,unit-package.txt,browser-package.json,popout-package.json,extension-package.json,package.json}`.
Screenshots: `output/review/space-range-320.png`, `space-range-390.png`,
`space-range-720.png`.

Updated local CHANGELOG.md and CHROMEWEBSTORE.md. Parent handles shared playbook,
ops log, and app wiki using verified live state. Next step: parent reviews this
branch, verifies the backend dependency, integrates/rechecks candidate version,
and owns the authorized distribution. No installed or public rollout is claimed.

---

# September 18 Survey extension alignment

## Current release checkpoint — 2026-09-18 18:06:22 MST (America/Phoenix)

Max explicitly authorized GitHub and Chrome Web Store release of the completed changes.
This supersedes historical no-publication restrictions below. Release **1.4.0** was
uploaded and submitted successfully on September 18, 2026 at 18:08 MST. Worktree and branch remain as recorded below.
Public Store and authenticated draft both verified **1.3.3** before release; GitHub
main remains the verified starting commit with no divergent changes. The original
Store screenshot and description are retained; the attempted listing refresh was reverted.
No installed-extension replacement or production business-record test is authorized or performed.

Final ZIP: `output/masterappsurvey-v1.4.0.zip`, 93,577 bytes, SHA-256
`bfeb47afa010231954f793fcc6c8e2db8261a145774fea1eb4294fcfb3ca24da`.
Extracted ZIP passes **167 unit tests, 43 browser scenarios, 6 real Chrome pop-out
scenarios and the MV3 runtime smoke** with synthetic data and blocked remote requests.
Evidence: `output/review/release-1.4.0-{unit.txt,browser.json,popout.json,extension.json,package.json}`.
Earlier database checks below are historical, not rerun for this version bump.
Release commit [f421c6b](https://github.com/maxsshind/masterappsurvey/commit/f421c6b4d216375d889cb74c7ead4283356d4fdc)
is verified on GitHub main and the feature branch; hosted privacy policy verified HTTP 200.
Exactly one upload returned HTTP 200 / SUCCESS; draft version verified 1.4.0.
Exactly one publication returned HTTP 200 / OK at 18:08 MST. Google review/public
availability is separate; installed runtime was not changed or checked. Credential-free
API evidence: `output/review/cws-1.4.0-upload.json` and `cws-1.4.0-publish.json`.
Release ZIP saved with matching hash to `/Users/maxschumacher/Developer/masterappsurvey/masterappsurvey-v1.4.0.zip`.
Checkpoint updated 2026-09-18 18:08:58 MST. No further release submission is needed.
Shared documentation remains unsaved.

## Historical local-review checkpoint — 2026-09-18 17:48:25 MST (America/Phoenix)

**Local implementation and review package complete. Distribution and live authenticated verification remain outside this task.**

Owner: Codex local worktree `/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey`, branch `codex/survey-alignment-20260918`. Parent task `01a0a745-9c5e-7da1-a3ad-baed72677798`.

Authorized: implement and test Survey alignment; prepare a review ZIP. **No Store upload/publication, installed-extension reload/replacement, main-app changes, or historical client-data repairs.** No production records were used for testing. The saved project checkout and Max's browser profiles were untouched.

Verified starting HEAD and fetched `origin/main`: `ecf1b6776fc5a0bf2f11bd5aaa5db1e72ee4e70f`. Manifest stays **1.3.3**, solely as the review baseline; this is not a newly numbered release. Current Store draft, public version and installed runtime were not rechecked.

## Follow-up: flyer attachment beside Save — current build

Moved **Attach open CoStar flyer (PDF)** from the collapsed Flyer and photo section
to the fixed bottom action bar, directly above **Add to survey**. Manual URLs stay
in the details section. Added bottom content space so the taller bar does not cover
the final fields. The existing attachment handler, suite targeting and save locks
are unchanged. All earlier NNN, rent, layout and pop-out changes remain included.

- [Current ZIP](/Users/maxschumacher/Developer/masterappsurvey/masterappsurvey-v1.3.3-flyer-footer-review-2026-09-18.zip) — 93,577 bytes; SHA-256 `0546afd41d3c4a2c74ade8c9b8ba1feb8bca6aac4761952785ea06f906ec11c0`.
- [Ready-to-load folder](/Users/maxschumacher/Developer/masterappsurvey/local-extension/survey-review-flyer-footer-2026-09-18). Source, ZIP and delivered files match across all 14 runtime/icon files.
- Current source verification: **11 layout tests, 43 browser scenarios, 6 actual Chrome pop-out scenarios** passed. The existing delayed-flyer scenario now clicks the fixed button without expanding details and verifies original-suite ownership. No remote requests or production uploads. [Layout evidence](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/flyer-footer-layout-source.txt), [browser evidence](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/flyer-footer-browser-source.json), [pop-out evidence](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/flyer-footer-popout-source.json).
- Visually checked [320px panel](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/flyer-footer/survey-st-320.png) and [720px pop-out](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/flyer-footer-popout/window-720.png); attach and Save both remain visible. Prior full numeric/database coverage below remains historical; those modules were not changed by this placement adjustment.

Local changelog/release guide updated; this presentation-only review does not need
shared playbook, production ops-log or wiki changes. Installed extension and Store
remain unchanged. Next step: review this latest folder and use the flyer button in
the bottom bar. Existing release restrictions remain.

## Follow-up: NNN expense default — earlier review build

Max clarified that an NNN offering has separate expenses. New/imported NNN drafts
now default to **Separate charge**, with both expense inputs visible. Choosing NNN
also applies that treatment while retaining entered expense amounts. Unknown amounts
remain blank and the all-in total stays blank until expenses are known. Restoring an
older new draft applies the default; explicit expense overrides survive remount.
Reset restores the NNN default for a new draft. Existing saved calculation metadata
and unlinked historical amounts are preserved on open and notes-only edits; displaying
the known NNN treatment does not adopt or recompute an unlinked quote. Other lease
types retain their existing expense behavior. The pop-out and previous fixes remain.

- [Current ZIP](/Users/maxschumacher/Developer/masterappsurvey/masterappsurvey-v1.3.3-nnn-expenses-review-2026-09-18.zip) — 93,565 bytes; SHA-256 `5a0c629d56780ef025d2381d335127a23602101b7c2b27756cafc9933684633e`.
- [Ready-to-load folder](/Users/maxschumacher/Developer/masterappsurvey/local-extension/survey-review-nnn-expenses-2026-09-18); [390px preview](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/nnn-expenses-390.png).
- Source and extracted ZIP each pass **167 unit tests, 43 browser scenarios and 6 pop-out scenarios**. New checks cover scraped/manual NNN defaults, blank expenses, all-in math, retained expense quotes, deliberate overrides/reset and notes-only preservation of historical NNN precision. Actual packaged MV3 worker/panel smoke also passes. Fixtures only; zero remote requests.
- Evidence: [source units](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/nnn-unit-source.txt), [ZIP units](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/nnn-unit-package.txt), [source browser](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/nnn-browser-source.json), [ZIP browser](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/nnn-browser-package.json), [source pop-out](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/nnn-popout-source.json), [ZIP pop-out](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/nnn-popout-package.json), [MV3](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/nnn-extension-package.json), [archive](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/nnn-package.json).

Local changelog/release guide updated. Shared playbook/ops/wiki release updates are
not needed for this local revision; the three-destination check below still applies.
The Surveys guide's rules preserving unlinked amounts and unknown totals informed
the implementation. No production data, main-app, installed-extension or Store
change. Next step: review this latest folder; earlier authenticated-release limits
remain. Previous review folders are preserved.

## Follow-up: pop-out mode — earlier review build

Max requested a pop-out mode. Replaced the obscure icon with a labeled **Pop out**
button. Opens a resizable window at up to 720×900, bounded by the available screen;
the form can expand to 820px when resized. The detached header identifies the mode.
The source panel closes only after the destination restores its Survey workspace
and Comp controls. Survey active suite/IDs/amounts/notes and Comp raw fields,
checkboxes, existing deal/property choice, baseline and flyer survive. The one-use
handoff is account-scoped in Chrome session memory and removed after transfer or
handled failure. Pending-save recovery keeps precedence. Busy reads/uploads/saves
block handoff; opening/storage failures leave the source editable. Opening again
focuses the existing popup without replacing either form's edits.

- [Current ZIP](/Users/maxschumacher/Developer/masterappsurvey/masterappsurvey-v1.3.3-popout-review-2026-09-18.zip) — 93,324 bytes; SHA-256 `9ca853af3bb146406f377c47655748cfbc24f19ca5cf2c6cab3176ffa2768217`.
- [Ready-to-load folder](/Users/maxschumacher/Developer/masterappsurvey/local-extension/survey-review-popout-2026-09-18). Previous review folders and installed extension remain untouched.
- Source and extracted ZIP: **167 unit tests**, **41 existing browser scenarios** and **6 real pop-out scenarios** passed. Pop-out checks use real Chrome windows/session storage with synthetic database replies in a disposable profile; all remote requests are blocked. The separate actual MV3 worker/panel smoke also passed on the final ZIP.
- Evidence: [source pop-out](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/popout-runtime-source.json), [ZIP pop-out](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/popout-runtime-package.json), [source unit tests](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/popout-unit-source.txt), [ZIP unit tests](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/popout-unit-package.txt), [source browser](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/popout-browser-source.json), [ZIP browser](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/popout-browser-package.json), [MV3](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/popout-extension-package.json), [archive](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/popout-package.json).
- Visually checked [320px panel](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/popout/panel-320.png) and [720px pop-out](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/popout/window-720.png); no horizontal overflow and Save remains reachable.

The rent fix, requested section order and simplified pricing remain included. Local
changelog, release guide and privacy draft cover this change. Shared playbook/ops/wiki
release updates remain unnecessary for this local review build; the prior three-
destination check below still applies. No production save or installed-copy test
occurred. Next step: review this latest folder, then use **Pop out** in its header.
Store/installation restrictions and prior authenticated-verification limits remain.

## Follow-up: simplified pricing — earlier review build

Max explicitly requested removal of the calculation-area explanation, yellow CoStar source box and monthly-review checkbox shown in his screenshots. Removed those elements, the empty-total waiting message, and the checkbox's save gate/event handler. Normal Save now submits valid amounts without that extra confirmation. Source evidence remains private; exact selected-space monthly prefill, strict numeric validation, linked calculations, uncertain-save recovery and existing-row protection remain. This request supersedes the original separate monthly-confirmation UI requirement; it does not authorize any Store/installation or production-data change.

- [Current ZIP](/Users/maxschumacher/Developer/masterappsurvey/masterappsurvey-v1.3.3-clean-pricing-review-2026-09-18.zip) — 91,194 bytes; SHA-256 `c8596737d267bdac12317755cd70b8e63e8d981a728a7b64780e5e916b1f5eb4`.
- [Ready-to-load folder](/Users/maxschumacher/Developer/masterappsurvey/local-extension/survey-review-clean-pricing-2026-09-18); [pricing preview](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/clean-pricing/selected-space-390.png). Existing installed/review folders untouched.
- **167 unit tests and 41 browser scenarios** pass on source and extracted ZIP. Mounted checks verify the removed elements are absent, monthly rent saves without a checkbox, annual source remains unadopted, and edited values survive re-read. [Source unit evidence](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/clean-pricing-unit-source.txt), [ZIP unit evidence](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/clean-pricing-unit-package.txt), [source browser](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/clean-pricing-browser-source.json), [ZIP browser](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/clean-pricing-browser-package.json), [actual MV3 smoke](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/clean-pricing-extension-package.json), [archive evidence](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/clean-pricing-package.json).

The Area → Monthly pricing → Availability order is retained. No shared production release documentation needs updating for this local revision; prior live-authenticated save limitations remain. Next step: use this latest review folder for manual checking; installed code remains unchanged.

## Follow-up: Area → Monthly pricing → Availability — earlier review build

Max requested the Area section where Availability was, Monthly pricing directly below Area, and Availability/client Notes/Date below pricing. Implemented in both default HTML and saved-layout normalization. Layout v3 stores the exact previous preferences under `layout_prefs_survey_v2_backup`, retains the older v1 backup, and preserves Comp settings and draft values. This explicitly supersedes the earlier requirement to keep Availability/Notes/Date above the fold.

- [Current ZIP](/Users/maxschumacher/Developer/masterappsurvey/masterappsurvey-v1.3.3-area-first-review-2026-09-18.zip) — 92,297 bytes; SHA-256 `5a54fa185d4918998c98c28ff618a7df3fe409d133f032d3bc2258b01cb020eb`.
- [Ready-to-load folder](/Users/maxschumacher/Developer/masterappsurvey/local-extension/survey-review-area-first-2026-09-18). Existing installed/review folders were not changed.
- [390px preview](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/area-first/survey-st-390.png).
- Verified **167 unit tests and 41 browser scenarios** on source and extracted ZIP, including saved-layout migration/backup, the requested order at 320×740, 390×844 and 560×900, accessible Save and no horizontal overflow. [Source tests](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/area-first-unit-source.txt), [ZIP tests](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/area-first-unit-package.txt), [source browser](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/area-first-browser-source.json), [ZIP browser](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/area-first-browser-package.json), [actual MV3 smoke](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/area-first-extension-package.json), [archive evidence](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/area-first-package.json).

Rent-fix behavior is retained. No pricing/data/schema changes, Store publication or installed-extension replacement. Shared production documentation does not need a release entry for this local layout revision. Next step: load this review folder when ready and verify the requested order in the test extension. Prior live-authenticated save limitations remain unchanged.

## Follow-up: selected-space rent fix — earlier review build

Max reported the rent blank while CoStar's open Space Details showed 40,000 SF, Rent $0.65, Rent/Mo $26,000 and Triple Net. Read-only inspection of the actual open Chrome page confirmed those labels and a separate 380,569-SF building summary. The original scraper selected the summary first; the new draft intentionally did not adopt its ambiguous quote.

Fixed: a unique open Space Details section supplies exact monthly total, offered SF, office SF and service type. New blank offerings prefill explicit monthly rent for review. Tenancy remains a deliberate choice; selecting MT calculates $0.65/SF from 40,000 SF, never the 380,569-SF reference building. Expense amounts/all-in total stay unknown. Saved or edited rents are not replaced; clearing rent stays cleared. Different selected spaces at one building retain distinct draft identities. Annual/ranged/malformed/conflicting/repeated quotes remain unresolved. Original Comp scrape/save behavior stays unchanged.

- [Current review ZIP](/Users/maxschumacher/Developer/masterappsurvey/masterappsurvey-v1.3.3-survey-review-rent-fix-2026-09-18.zip) — **92,289 bytes**, SHA-256 `fdaa084dd8bdbbe9c55876e5596e93353520415f0ae8f01edee5e51f9241d12d`.
- [Already-extracted folder for Load unpacked](/Users/maxschumacher/Developer/masterappsurvey/local-extension/survey-review-rent-fix-2026-09-18). This is a new isolated folder; no installed extension was reloaded/replaced. The earlier ZIP/folders remain intact.
- [Updated 390px pricing preview](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/rent-fix-selected-space-390.png).
- **167 unit tests** and **41 browser scenarios** passed against source and extracted ZIP: [source units](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/rent-fix-unit-source.txt), [package units](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/rent-fix-unit-package.txt), [source browser](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/rent-fix-browser-source.json), [package browser](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/rent-fix-browser-package.json). New tests exercise the actual scraper → panel draft → serializer, including explicit zero, plus mounted review/edit/re-read/space-switch behavior.
- Packaged canonical rent modules passed **1,003 PostgreSQL assertions** again; the final text-only source-summary shortening did not change those modules. [Database evidence](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/rent-fix-database-package.json).
- Final package [actual MV3 smoke](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/rent-fix-extension-package.json) passed in a disposable profile. Parent inspected the new scraper/tests, reran checks and verified 14-file source/extracted/delivered byte parity. [Package hash evidence](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/rent-fix-package.json).

Next manual check after loading this review folder: open one CoStar Space Details, click Re-read, confirm tenancy/offered area and monthly quote, then review before saving. Task-owned test servers on ports 8898/8899 were stopped and verified closed; temporary test profiles were removed. Current installed code was not replaced or exercised with the fix; no production save occurred. Existing live-authenticated release limits below still apply. Manifest remains 1.3.3 review-only; no Store upload/publication. Shared playbook/ops/wiki status remains unchanged: this is a local correction, not a production release.

## Initial review artifacts — superseded by the rent-fix build

- [Review ZIP](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/masterappsurvey-survey-review-20260918.zip): **89,976 bytes**, 14 runtime/icon files.
- SHA-256: `d4b3d82849d86a2fe34d66edcf682482cebcc773ef9c68191574fe8349fa80d4`.
- [Package evidence](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/package.json).
- Screenshot paths below are refreshed during current layout verification; they are not immutable initial-release captures. [320px panel](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/survey-st-320.png), [390px panel](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/survey-st-390.png), [560px panel](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/survey-st-560.png), [MT monthly pricing](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/survey-mt-pricing-390.png).

The archive contains only manifest/config, panel/worker/runtime scripts, stylesheet and three icons. It excludes documentation, fixtures, drafts, environment files and credentials. `package.sh` checks imports, icons, archive integrity and source byte parity. `publish.sh --package-only` packages locally; any other invocation exits without networking. No upload or installation command was run.

## Implemented behavior

- Canonical linked monthly total/SF/acre calculations, explicit offered acreage and expense treatment. Suite SF supplies MT math; building/parcel facts do not silently become offered area. Zero, blank, historical precision and untouched legacy values remain distinct.
- Scraped quote text retains period/basis as private evidence. General summary rent is not automatically adopted. The follow-up above prefills explicit selected-space monthly totals for review. Exact selected-space monthly quotes can prefill; normal Save accepts valid entered amounts without a separate confirmation checkbox. No automatic annual conversion or expense-exclusive split is inferred.
- Independent spaces and combined alternatives have their own terms, notes, flyer, validation and stable IDs. Building matches require a deliberate suite target. Shared building facts seed new spaces without copying sibling terms.
- Atomic bulk inserts use stable IDs, ignore duplicates and full readback. Durable account/survey requests retain the reviewed payload through retries, reopen, another panel's pending request and lost responses. Uncertain dispatched saves stay locked. Existing-row writes require the selected ID, survey and original `updated_at`; stale rows require review.
- Minimal dirty patches preserve metadata, custom/null choices and client feedback. Removed unsupported Survey `property_name` writes: the canonical SurveyProperty/table has no such column. Comp's separate property-name field remains supported.
- Visible choices, Area and Monthly pricing before Availability/client Notes/Date, expandable Notes 2, errors, keyboard controls and persistent Save actions work at 320×740, 390×844 and 560×900. Survey layout v3 retains an exact prior backup and preserves Comp preferences/density.
- Drafts persist by account/survey; Settings clears resolved drafts. Pending uncertain requests cannot be cleared as ordinary drafts. Local privacy text covers retention, private evidence and flyer upload timing.
- Existing Comp property-linking/yard/separate-deal behavior is preserved. No new permissions, hosts, analytics or remote code.

## Initial review verification

The parent independently reran the Survey checks, inspected screenshots and verified artifacts. Synthetic fixtures only; mounted browser tests block external requests.

| Check | Source | Final extracted ZIP | Evidence / scope |
|---|---:|---:|---|
| Node tests | 151 passed | 151 passed | [Source](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/unit-source.txt), [ZIP](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/unit-package.txt); rent, fields, spaces, transport, layout and original Comp regressions |
| Actual PostgreSQL parity | 1,003 assertions | 1,003 assertions | [Source](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/database-source.json), [ZIP](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/database-package.json); unmodified migrations, canonical web TypeScript and extension serializers |
| Mounted browser scenarios | 38 passed | 38 passed | [Source](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/browser-source.json), [ZIP](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/browser-package.json); 19 Survey, 13 property-linking, 6 yard |
| Actual MV3 worker and panel | Passed | Passed | [Source](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/extension-source.json), [ZIP](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/extension-package.json); disposable Chrome profiles, imports/auth status checked, no remote requests |

The existing Comp extension-to-PostgREST suite passed **40 checks against final source and 40 against an earlier extracted package**, with **174 canonical fixture assertions**. The parent inspected the original execution evidence and independently verified every loaded code hash against the final ZIP: [source result](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/comp-source-roundtrip.json), [earlier package result](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/comp-package-roundtrip.json), [final code parity](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/comp-final-package-code-parity.json). Only the missing `chrome.runtime` test mock was corrected. Coverage includes five statuses, exact/alias/new/ambiguous/skip, original-ID guards, rollback, response loss, concurrency and session refresh. No main-app files were edited. The canonical fixture completed its 174 assertions, then its requested keep-alive shutdown emitted PostgreSQL `57P01` and exited 1; that cleanup exception is retained in the [full evidence](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/output/review/comp-canonical-fixture-roundtrip.json), not reported as a clean process exit. Database/proxy processes, fixture directories and ports were verified removed.

Database coverage includes 120 deterministic decimal cases, linked/legacy groups, blank/zero, coordinated area changes, expense switches, precision, unknown-metadata rejection, atomic rollback/no overwrite and independent suites. Browser coverage includes suite targeting, source reread, error focus, multi-space and combined options, stale writes, delayed flyer ownership, storage/lookup failures, lost responses, account/survey isolation and another panel's pending request.

Final archive integrity, 14-file source/extracted byte parity, JavaScript/shell syntax and diff whitespace checks passed. Test browsers/profiles were closed after each run. Task-owned source/package servers on ports 8898/8899 were stopped and verified closed; the unrelated existing 8783 server was preserved.

## Verified limits and next step

1. **Live authenticated behavior remains unverified:** no current signed-in CoStar page, production Survey save, web/client reopen or production RLS check. The native Survey harness verifies schema/trigger calculations, not production authentication/rendering. Mounted mocks and isolated MV3 checks have separate scopes.
2. The current version-1 database trigger rejects even unrelated updates when metadata has an unknown future version. The extension preserves it and reports rejection; no migration/overwrite. This was reproduced against the actual trigger with the row unchanged.
3. Duplicate suite labels are checked in drafts and complete saved-row preflight. No database uniqueness constraint exists for labels, so independent simultaneous clients can race. Stable-ID retries protect the same attempted save, not cross-client label uniqueness.
4. Direct Comp rent intake is unchanged. This work does not certify its scraped rent or apply the separate web Survey-to-Comp bridge's monthly/expense-exclusive confirmation.
5. Select an unused release version only after an authorized Store check. Refresh hosted privacy/listing screenshots and verify the current submission API before upload. Preserve sign-in/preferences/pending drafts before any authorized installation change. Submission does not prove public or installed availability.

**Exact next step:** review the ZIP/screenshots and, when separately authorized, run authenticated disposable-fixture checks from CoStar through saved Survey and broker/client web reopen. Check installed source/type and Store state before numbering/distribution. Preserve the current no-publication/no-installation restriction until authorization changes.

## Contracts and reproduction

- [Implementation contract](/Users/maxschumacher/.codex/worktrees/survey-rent-calculator-20260918/master-app/docs/SURVEY_CHROME_EXTENSION_UPDATE_PLAN.md).
- Canonical read-only main-app worktree: `/Users/maxschumacher/.codex/worktrees/survey-rent-calculator-20260918/master-app`. Modules record source revision `dc082c935668da0b7bb8e4c8ad403e7f15a4a120`; database outputs record hashes of actual tested canonical files/migrations. Concurrently maintained HEAD was `9fd40aa8d1d517d7c170ea819fd313423c6ee533` at final handoff check.
- Runtime order: `survey-fields.js`, `survey-rent.js`, `survey-spaces.js`, then panel/worker; verified in actual MV3.
- Units: `node --test tests/*.test.cjs`; use `EXTENSION_ROOT` for extracted runtime modules.
- Database: `node tests/survey-database-roundtrip.cjs /Users/maxschumacher/.codex/worktrees/survey-rent-calculator-20260918/master-app /private/tmp/master-geocode-postgres-tools/node_modules/embedded-postgres/dist/index.js`. Requires the local fixture dependencies; creates/removes its own loopback PostgreSQL instance.
- Mounted browser: serve source/extracted root on loopback, then `node tests/run-browser.cjs tests/survey-browser.js tests/property-linking-browser.js tests/yard-browser.js` with `SURVEY_TEST_PORT`, `PLAYWRIGHT_MODULE` and optional `CHROMIUM_PATH`. The runner remaps fixture port 8783 to the task-owned port.
- Actual MV3: `node tests/extension-runtime.cjs`, optional `EXTENSION_ROOT`, `PLAYWRIGHT_MODULE`, `EXTENSION_CHROMIUM_PATH`. Always uses a fresh disposable profile.
- Playwright used: `/Users/maxschumacher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`. Chrome: `/Users/maxschumacher/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`.
- Package: `./package.sh`. Filesystem timestamps may change the archive hash on rebuild; rerun byte parity and extracted checks after runtime changes.

## Documentation completion check

Updated locally: this checkpoint, [changelog](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/CHANGELOG.md), [release guide](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/CHROMEWEBSTORE.md), [privacy draft](/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey/PRIVACY_POLICY.md). They distinguish this review build from the historical September 10 release.

Checked all three shared destinations: [Surveys playbook](/Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/max-playbook-and-knowledge/master-app/surveys-reference.md), [ops index](/Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/max-playbook-and-knowledge/ops-changelog.md) / [September log](/Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/max-playbook-and-knowledge/archive/ops-2026-09.md), and [existing Surveys wiki mirror](/Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/wiki/surveys.md). The [live wiki](https://www.sshteam.app/wiki/surveys) was not authenticated in this task and remains unchecked here. Shared references already distinguish released web features from extension behavior. No shared release claim or production ops entry is appropriate for this local review build; none was changed. At actual release, propose one verified playbook/ops/wiki batch for approval.

## Milestones

- September 18: clean isolated baseline; canonical contracts/shared references read; bounded calculator, spaces/transport, layout and database checks delegated.
- September 18: implemented calculations, deliberate offering identity, safe retries and compact UI; addressed schema mismatch, uncertain recovery, delayed flyer ownership and cross-panel pending-state findings.
- September 18: packaged and independently reran source/extracted unit, database, browser and actual MV3 checks; preserved distribution restrictions and recorded remaining live verification.
