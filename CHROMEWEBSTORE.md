# Chrome Web Store — CoStar → Survey Pusher

Last updated: 2026-09-18

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

`./package.sh` builds a local archive with an explicit 14-file runtime/icon allowlist.
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
