# September 18 Survey extension alignment

## Current checkpoint — 2026-09-18 17:18:18 MST (America/Phoenix)

**Local implementation and review package complete. Distribution and live authenticated verification remain outside this task.**

Owner: Codex local worktree `/Users/maxschumacher/.codex/worktrees/9571/masterappsurvey`, branch `codex/survey-alignment-20260918`. Parent task `01a0a745-9c5e-7da1-a3ad-baed72677798`.

Authorized: implement and test Survey alignment; prepare a review ZIP. **No Store upload/publication, installed-extension reload/replacement, main-app changes, or historical client-data repairs.** No production records were used for testing. The saved project checkout and Max's browser profiles were untouched.

Verified starting HEAD and fetched `origin/main`: `ecf1b6776fc5a0bf2f11bd5aaa5db1e72ee4e70f`. Manifest stays **1.3.3**, solely as the review baseline; this is not a newly numbered release. Current Store draft, public version and installed runtime were not rechecked.

## Follow-up: Area → Monthly pricing → Availability — current build

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
- Scraped quote text retains period/basis as private evidence. General summary rent is not automatically adopted. The follow-up above prefills explicit selected-space monthly totals for review. Populated adopted quotes require explicit monthly review for the selected offering; source changes invalidate confirmation. No automatic annual conversion or expense-exclusive split is inferred.
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
