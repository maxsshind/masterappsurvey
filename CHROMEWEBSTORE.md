## Chrome Web Store submission1.4.13 — 2026-09-18T22:32:28.493908-07:00

User explicitly authorized publishing and updating the existing listing; then required CLI use. Existing item hohikcikmjiopimpigebcbdileipbhhc was read through authenticated API: draft1.4.0. Exactly one1.4.13 upload returned HTTP200/SUCCESS; draft reread confirmed1.4.13; exactly one publish returned HTTP200/statusOK. Submitted for Google review, not confirmed public. No cancellation or installed update. Existing listing identity retained. Long description/screenshots cannot be changed through the official Store API and were not changed; user required CLI. Credentials read privately from canonical .secrets; no tokens logged.

ZIP117445bytes SHA25645adf45d58cfa049b3b10d57bf6e48d8ba44532fb2fc45e55df2116e05946fbe. Credential-free evidence output/review/cws-1.4.13-{upload,read,publish}.json. Local implementation checks described below. Publication approval/public rollout remains Google-controlled. Shared documentation proposal pending approval; no shared writes.

---

## 1.4.13 — Wide panel layout (local candidate)

At680px+, related sections and fields sit beside one another to reduce scrolling. Top description and feature checkboxes retained; narrow view stays stacked. ZIP masterappsurvey-v1.4.13.zip is delivered locally; no installation or Store submission. See PROJECT.md for verification.

## Local correction1.4.12

Supersedes local1.4.11: feature checkboxes restored at user request. Latest ZIP is masterappsurvey-v1.4.12.zip in canonical Master App Survey folder. No installed update or Store action. Preserve existing extension ID/storage during any separately authorized update.

## Local layout candidate 1.4.11

Review ZIP: `masterappsurvey-v1.4.11.zip`; delivered under canonical Master App Survey. Preserve installed extension ID/storage and finish active drafts before any separately authorized replacement. Chrome owns docked side-panel width: drag its edge wider (target roughly50% more); form adapts through840px. Source301 units, browser regression/compact checks,8 pop-outs and packaged MV3 smoke passed. No Store upload/publication or installed-copy replacement. See PROJECT.md for evidence and exact source.

# Chrome Web Store — CoStar → Survey Pusher

## 1.4.10 local candidate — 2026-09-18 — Reviewed Power sources and clean Loading

- Power uses Sale Highlights, Sale Notes or listing descriptions first. In an open
  suite, only that space's Highlights/Space Notes qualify. Property Power remains
  blank until **Use property value** is selected; **Keep blank** is a deliberate clear.
- Bounded property fields exclude Utilities/walkability and Levelators; Levelators
  never appear in Loading. Power keeps qualifiers, scope, ranges and wire counts.
  Power Road and Suite100A are not electrical evidence. Heavy power is independent.
- Re-read, updates, pending retries and pop-outs preserve reviewed values/clears.
  Divisible portions do not inherit whole-building Power or its property fallback.
- Retains complete1.4.9 flyer scope flags, suite safeguards and shared building flyers.
  Backend237c98a separately fixes generic32KB errors; existing1.4.9 can retry analysis
  without reloading. The rejected68thAve field is not yet established.
- Verified301units,92mounted scenarios,8actualpopouts,10propertyMV3,12suite/flyerMV3,
  5SalesMV3,flyerworker and MV3smoke; screenshot320/390px. All isolated fixtures,
  zero real-record writes. Source/ZIP/extracted18fileparity verified.
- ZIP `/Users/maxschumacher/Developer/chrome extensions/Master App Survey/masterappsurvey-v1.4.10.zip`
  and extracted `output/review/space-extension-1.4.10` under the same directory.
  115743bytes;SHA256 `1df36750bc1b2788eac007c9e99d104b071d6ac2584b7f307f21a2173890ec48`.
- Local package only. Installed1.4.9 and user drafts remain untouched; no Store
  upload/publication. Save/cancel active work before in-place replacement and Reload
  of the same existing extension. Reverify its ID/path; preserve local storage.


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

## Historical local candidate1.4.7

ZIP: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey/masterappsurvey-v1.4.7.zip`
Extracted: `/Users/maxschumacher/Developer/chrome extensions/Master App Survey/output/review/space-extension-1.4.7`
SHA256: `0d9d7d30e8ec1894d5bddc3be209a4ab47cfa58dd8167bd02a796a7c2b091f28`
109,957bytes;16runtime/iconfiles match source,ZIPandfolder. SeeCHANGELOG for checks.

Fresh read-only Chrome files: version1.4.5, ID`oigefkpjdbpbablcmnejkoaclonnhggp`,
path`/Users/maxschumacher/Library/Application Support/Google/Chrome/Default/UnpackedExtensions/masterappsurvey-v1.4.5_klToDY`.
These supersede older1.4.4observations. Installed capture/drafts were not touched.
After Max saves/cancels any active edit, reverify the ID/path, back up runtime,
copy verified candidate runtime files into that SAME installed folder and Reload
that SAME extensioncard. Reload alone does not replace files. Do not Remove or
Load unpacked as a new identity when preserving drafts. No Store upload occurred.


Last updated: 2026-09-18

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

### Updating the existing unpacked copy to 1.4.6

1. Save or intentionally cancel the active Comp edit first. The last read-only
   check showed an unsaved flyer for 2434 S 10th St; reloading now would lose it.
2. Verify the current installation. The observed 1.4.4 ID was
   `pnoophcbdjbdnpknbidojhiiecfmghhj`, at
   `/Users/maxschumacher/Library/Application Support/Google/Chrome/Default/UnpackedExtensions/masterappsurvey-v1.4.4_W1NaYy`.
   Back up that folder, then copy the verified 1.4.6 runtime files into this same
   folder. Keep the directory/extension ID and Chrome storage. Do not remove it.
3. In `chrome://extensions/`, Reload that existing extension card. Confirm version
   1.4.6, reopen the panel, and check the Comp Property details fields. No test save
   is needed. An open old panel must reload before the new controls appear.

This procedure is prepared, not executed. Reload by itself does not install 1.4.6
until its runtime files have replaced the existing folder's files. Do not load the
new extracted folder as a second extension when preserving the current ID/drafts.

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

## 1.4.3 local candidate — suite switching and shared flyers

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

## 1.4.2 candidate — captured-suite retention and SF commas

**Local tested package only; not uploaded/submitted/installed by this effort.**
Includes the 1.4.1 space-range changes below. Choosing **Add current CoStar space**
keeps the selected suite's captured details and reviewed edits. Refresh recovers
omitted details from legacy blank drafts without replacing entered/cleared values.
Manual entry is labeled **+ Blank space**. SF fields use thousands separators on
load and blur, preserving numeric precision and existing validation.

No new permissions, hosts or data categories. PROJECT.md records the exact ZIP,
delivery folder and verification. Preserve the existing extension ID/storage when
updating an unpacked installation; do not replace/reload Max's open draft as part
of packaging. Verify current Store/public versions before any separate submission.

## 1.4.1 candidate — divisible survey spaces

**Prepared locally, not uploaded/submitted/installed.** Verify the currently public
and draft version before any upload; the last recorded successful submission is
1.4.0 below. Parent release owner handles GitHub and distribution after the web app
and its `space_option` database migration are verified live.

Candidate changes: capture an explicit selected-suite size range; edit minimum,
maximum and proposed SF separately; use proposed area for monthly calculations;
re-enter total quotes after an area change; open Master App to confirm combined
suite members. Office/loading from the whole source are not assigned to an
unspecified portion. Existing data and notes-only updates remain compatible.
Refresh the Survey Area screenshot for the new range fields and Master App combine
link when Store assets are next updated. No changes to permissions, hosts, external
recipients or existing data categories; size metadata remains property data.

Package and test evidence will be recorded in PROJECT.md. Do not treat a local
package or disposable-profile smoke test as installed/public extension verification.

## 1.4.0 release — September 18

Uploaded and submitted on 2026-09-18 at 18:08 MST. Upload HTTP 200 / SUCCESS,
draft 1.4.0 verified, publication HTTP 200 / OK. Existing public/draft version was
1.3.3 before release. Google review and public availability remain separate. Final package and release verification are in PROJECT.md. Original Store
screenshot and description retained. No permission or host changes; hosted privacy
policy covers local drafts, retry recovery and the session-memory pop-out handoff.
`publish.sh` remains package-only; release uses separately checked API steps.

## Historical September 18 local review build

**Attach open CoStar flyer (PDF)** now stays in the fixed bottom bar, directly
above **Add to survey**. Manual flyer/photo URLs remain in their details section.

NNN now defaults to **Separate charge**, with expense inputs visible. Amounts
stay blank until entered; the all-in monthly total remains unknown until expenses
are known. Existing saved quotes and deliberate expense overrides are preserved.

Latest local build adds a labeled **Pop out** button and a wider, resizable window.
Survey drafts and unsaved Comp edits transfer before the original panel closes;
failed opening leaves the original form available. Existing pop-outs are reused.
The short-lived handoff stays in Chrome session memory, scoped to the signed-in
account; no permissions were added. PROJECT.md links the current ZIP and checks.

The build also removes the requested pricing explanations and monthly-review checkbox, including its save requirement. Valid pricing saves through the normal Save action. Exact monthly prefill, numeric validation and retry protection remain.

Current local layout: Area → Monthly pricing → Availability/client Notes/Date, including existing saved layouts. The area-first package and exact verification/hash are linked from PROJECT.md; rent-fix behavior remains included.

Latest local package includes the selected-space rent fix: explicit Rent/Mo and offered size now prefill for review from the open Space Details. Existing edits and separate-space drafts are preserved. See PROJECT.md for the current rent-fix ZIP/extracted folder, hash, 167 unit tests and 41 browser scenarios. Earlier review ZIP remains historical. No installed extension or Store state changed.

Implemented on `codex/survey-alignment-20260918`, based on verified `origin/main`
`ecf1b6776fc5a0bf2f11bd5aaa5db1e72ee4e70f`. See [PROJECT.md](PROJECT.md) for acceptance
coverage, package hash and remaining verification limits.

The local review ZIP retains manifest **1.3.3**, the approved starting baseline.
It is not a newly numbered release and must not be uploaded as-is. Select an unused
version after checking current Store draft/public state when distribution is authorized.
**No upload, publication, installed-extension reload/replacement, or production data
change occurred. Current public/installed versions were not rechecked.**

Survey changes: editable linked monthly total/SF/acre rent, offered acreage, explicit
expenses, selected-space monthly rent prefill, independent spaces and explicit suite targets,
atomic stable-ID batch retries, stale-update protection, strict numbers, visible
choices, availability/client notes below pricing, expandable Notes 2, local draft recovery,
and Survey-only layout migration. Comp input behavior and its existing save safeguards
remain unchanged; direct Comp rent intake does not inherit the separate web bridge's
monthly/expense-exclusive confirmation safeguard.

Local storage now retains account/survey drafts and exact uncertain Survey requests;
see the local [privacy-policy update](PRIVACY_POLICY.md). There are no new permissions,
hosts, analytics, remote code or external data recipients. Refresh the hosted policy
and Store screenshots only as part of an authorized release.

`./package.sh` builds a local archive with an explicit 15-file runtime/icon allowlist.
`./publish.sh --package-only` does the same. The old unchecked upload/publish chain is
removed; running `publish.sh` otherwise exits without a network request. A future
release must separately verify the supported Store API, upload success, matching
draft version and publication response. Historical release evidence below remains historical.

## Release — September 10 historical evidence

- Item: `hohikcikmjiopimpigebcbdileipbhhc`
- [Store listing](https://chromewebstore.google.com/detail/hohikcikmjiopimpigebcbdileipbhhc)
- Package: `masterappsurvey-v1.3.3.zip` — **submitted successfully to the Chrome Web Store**.
- Scope: automatic property linking on comp save, explicit skip, ambiguous choice, Open Property, retained existing links, safe retry recovery, and suite/portion controls. Retains 1.3.2 Yard included behavior.
- Backend release dependency satisfied before submission: the owning main-app task verified production migrations `atomic_comp_property_save` (20260911041809) and `restrict_property_rpc_execution` (20260911042055), authenticated-only execution, approval/RLS guard, and a live alias read. No production comp writes were used as tests. Old raw comp-write fallback remains absent.
- Submission on 2026-09-10: preflight draft/public version 1.3.2; exactly one upload returned HTTP 200 / `SUCCESS`, draft verified 1.3.3, exactly one publication returned HTTP 200 / `status: ["OK"]`; post-publication draft remains **1.3.3**. Public Version field still **1.3.2** at 2026-09-10 21:23:40 Arizona; public availability of 1.3.3 remains unverified. No review cancellation or installation change was performed.
- Isolated source: `/Users/maxschumacher/.codex/worktrees/df90/masterappsurvey`, branch `codex/property-linking-extension`, based on 1.3.2 commit `ba55959`. The original checkout and active unpacked installation remain untouched.
- Prior installed Chrome runtime mismatch (1.3.0 runtime vs 1.3.1 loaded manifest) remains unresolved and was not altered by this work. A Store release does not replace that unpacked installation.
- [Technical release notes](/Users/maxschumacher/.codex/worktrees/df90/masterappsurvey/CHANGELOG.md). Permissions, hosts, store distribution, and authentication method are unchanged. Code and factual privacy changes were pushed to `main` at `84fa2ebd45f6ba6f292742959f64d7f9965334ab`; the existing hosted privacy-policy URL served the updated disclosure before submission. No privacy hosting/location change was made.

## Store listing and purpose

Name: CoStar → Survey Pusher

Manifest description: Push the CoStar property on your screen into a master-app survey or the comps database. Read-only on CoStar.

Purpose: review the open CoStar property's details and save or update that property in RGCRE surveys or market comps.

Comp features: save each deal under its building/site, choose among possible property matches, intentionally skip a link, and open the linked Property page. Keep new suites and subsequent sales/leases as separate deals. Recover a pending save safely after a lost connection. Record Suite, Portion of site, Multi-tenant building, and Yard included as explicit deal information; preserve Unknown values and deliberate edits when re-reading CoStar. Notes hold yard details and differences between sale and lease offers.

Existing listing copy, category (Workflow & Planning), English language, and unlisted distribution were documented in `STORE_LISTING.md`; they are historical metadata, not verified dashboard settings. No new store listing copy or screenshot was submitted in this release. Contact: max@rgcre.com. Homepage: https://www.sshteam.app.

## Permissions and data use

| Permission | Reason |
|---|---|
| `storage` | Retain sign-in session, last survey, form layout preferences, and the exact pending save until its result is confirmed. |
| `tabs` | Identify the open CoStar property and its flyer tab. |
| `scripting` | Read property details from the page the user is viewing. |
| `sidePanel` | Show the review-and-save form beside CoStar. |
| `https://*.costar.com/*` | Read the current property page. |
| `https://*.csgpimgs.com/*` | Retrieve the flyer selected by the user. |
| `https://kavynghiailoduhulytq.supabase.co/*` | Sign in and read/save the user's Master App records and flyers. |

Data includes the user's sign-in email/session, selected property details and links, listing contacts entered by the user, selected flyer PDFs, and a pending reviewed save stored locally by signed-in email for retry recovery. These support the requested Master App workflow. No new analytics, external recipients, remote code, hosts, or permissions are introduced. Temporary local pending-save storage is disclosed in the updated privacy policy. Existing local privacy source: `PRIVACY_POLICY.md`. The public listing links to [the hosted privacy policy](https://github.com/maxsshind/masterappsurvey/blob/main/PRIVACY_POLICY.md), verified HTTP 200 with session-token disclosure. Dashboard disclosure selections were not independently inspected.

## Assets and validation

- Manifest V3. Permission/host lists are unchanged from 1.3.2; the public Supabase key remains role `anon` and the existing signed-in session performs requests.
- Icon files: 16×16, 48×48, 128×128 PNGs. Runtime archive uses the explicit 11-file allowlist; no tests, docs, local secrets, or environment files are shipped.
- **22 Node regression checks passed**, including payload serialization, all five on-market statuses, all yard tri-state transitions, property modes, original-ID guards, scoped lookup, RPC-only comp writes, suite/portion fields, transport-vs-rejection handling, and preservation of unknown state. State is visible; a missing CoStar state is not silently filled as Arizona.
- **13 mounted property-linking scenarios and six existing yard scenarios passed** against source and the extracted 1.3.3 ZIP. Browsers use the real panel and mocked Chrome messages, with external networking blocked. All five listing statuses, R&G/external records, ambiguous choice/Cancel, explicit skip, failed lookup, failed/retried save, committed-but-lost response, panel reload, incomplete response, storage failure, and concurrent clicks are covered.
- Verified no horizontal overflow at 320px and 390px; keyboard selection/save, focus on ambiguous choice, and property-card visibility with older hidden/custom layouts passed. Visual evidence: `/tmp/masterappsurvey-property-choice-390.png` and `/tmp/masterappsurvey-property-legacy-320.png`.
- Live schema read verified every generated comp field and lookup column; `property_id`, `suite`, `partial_site_override`, and `multi_tenant` exist and are nullable. No production business-record writes were made for testing.
- **40 real extension-to-PostgREST checks passed** on source and extracted ZIP against a separate disposable local database using the final migration. Actual form/request builders and authenticated transport covered exact/alias/new/ambiguous/skip, all five statuses, site totals, rollback/no orphan, original-ID conflicts, committed-response loss, same-request and separate-suite concurrency, and session refresh. The fixture setup also passed the main-app's 151 database assertions. This was synthetic loopback data, not a production save. Run `node tests/property-linking-roundtrip.cjs http://127.0.0.1:8894` with the main-app disposable fixture/proxy; the test refuses non-loopback hosts.
- Existing `store-screenshot.jpg` remains historical. The property card and suite controls should be included in a future listing screenshot refresh; local fixture screenshots are not automatically uploaded.
- Package verified: **61,659 bytes**, SHA-256 `bcc2150f0f1444298992947d87a5aa08a76b1d4656ec3b35bf3824849d21a065`; archive integrity passed and all 11 runtime/icon files byte-match source. The extracted package passed the same 22 Node checks and 19 mounted browser scenarios. JavaScript syntax and diff whitespace checks passed.
- Optional read-only verification through the existing signed-in extension was unavailable: Chrome DevTools could not connect because no DevToolsActivePort was present. Chrome was not restarted and its unpacked installation was not modified. Main-app production checks and the real local extension roundtrip establish the released interface; no production save or new installed runtime is claimed.

## Submission evidence and API behavior

The 1.3.3 release used exactly one guarded upload and publication. Upload HTTP 200 / `SUCCESS`; draft 1.3.3 verified before publication; publication HTTP 200 / `status: ["OK"]`, `statusDetail: ["OK."]`; post-publication draft 1.3.3. Public Version field still **1.3.2** at 2026-09-10 21:23:40 Arizona; public availability of 1.3.3 remains unverified. Credential-free evidence: `/tmp/masterappsurvey-cws-1.3.3-result.json`. The existing `publish.sh` was not used because it does not gate publication on upload success. [Google's current API reference](https://developer.chrome.com/docs/webstore/api/v1) still supports V1 for this September release; it documents the October 15, 2026 sunset for future release planning.

The 1.3.2 release used a checked submission path rather than `publish.sh`, which does not gate publication on upload success. Exactly one upload returned HTTP 200 / `SUCCESS`; a subsequent draft read returned `crxVersion: 1.3.2`. Exactly one publication request then returned HTTP 200, `status: ["OK"]`, `statusDetail: ["OK."]`; the final draft read still confirms 1.3.2. The GET response's `uploadState: NOT_FOUND` tracks only uploads that initially returned `IN_PROGRESS`, so it does not contradict this synchronous upload's success. See [Google's v1 resource reference](https://developer.chrome.com/docs/webstore/api/v1). Local credential-free responses are in `/tmp/masterappsurvey-cws-1.3.2-result.json`. No review cancellation, duplicate upload, or duplicate publication was performed.

## Version history

| Version | Date | Change | Status |
|---|---|---|---|
| 1.3.3 | 2026-09-10 | Atomic property linking, visible skip/link states, save recovery, suite/portion controls | Submitted: upload SUCCESS, publication OK, draft 1.3.3; public 1.3.2 |
| 1.3.2 | 2026-09-10 | Yard included tri-state comp field | Public Version field and draft API verified 1.3.2 on 2026-09-10 |
| 1.3.1 | 2026-09-10 | Repair comp schema compatibility | Public listing verified 1.3.1; local runtime mismatch unresolved |
| 1.3.0 | 2026-07-28 | Customizable form layout | Installed in Chrome and returned by Web Store API on 2026-09-10 |
