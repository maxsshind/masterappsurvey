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

**Deployment dependency:** `survey_properties.space_option` and the web app's
range/combination validation and projection must be live first. Contract:
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
