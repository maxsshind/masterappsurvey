# Chrome Web Store — CoStar → Survey Pusher

Last updated: 2026-09-10

## Release

- Item: `hohikcikmjiopimpigebcbdileipbhhc`
- [Store listing](https://chromewebstore.google.com/detail/hohikcikmjiopimpigebcbdileipbhhc)
- Next package: `masterappsurvey-v1.3.3.zip` — **prepared only; not uploaded or published**.
- Scope: automatic property linking on comp save, explicit skip, ambiguous choice, Open Property, retained existing links, safe retry recovery, and suite/portion controls. Retains 1.3.2 Yard included behavior.
- Release dependency: main app `save_comp_with_property` must be live and verified before this package is submitted. Old raw comp-write fallback is intentionally absent. The main property-linking task owns the backend rollout and final extension publication.
- Read-only release recheck on 2026-09-10: Store draft API returned `crxVersion: 1.3.2`, and the public listing's **Version** field reads **1.3.2**. No 1.3.3 upload, publication, review cancellation, or installation change was performed.
- Isolated source: `/Users/maxschumacher/.codex/worktrees/df90/masterappsurvey`, branch `codex/property-linking-extension`, based on 1.3.2 commit `ba55959`. The original checkout and active unpacked installation remain untouched.
- Prior installed Chrome runtime mismatch (1.3.0 runtime vs 1.3.1 loaded manifest) remains unresolved and was not altered by this work. A Store release does not replace that unpacked installation.
- [Technical release notes](/Users/maxschumacher/.codex/worktrees/df90/masterappsurvey/CHANGELOG.md). Permissions, hosts, store distribution, and authentication method are unchanged. Privacy documentation is updated and must be pushed to its existing hosted URL before submission.

## Store listing and purpose

Name: CoStar → Survey Pusher

Manifest description: Push the CoStar property on your screen into a master-app survey or the comps database. Read-only on CoStar.

Purpose: review the open CoStar property's details and save or update that property in RGCRE surveys or market comps.

Comp features: save each deal under its building/site, choose among possible property matches, intentionally skip a link, and open the linked Property page. Keep new suites and subsequent sales/leases as separate deals. Recover a pending save safely after a lost connection. Record Suite, Portion of site, Multi-tenant building, and Yard included as explicit deal information; preserve Unknown values and deliberate edits when re-reading CoStar. Notes hold yard details and differences between sale and lease offers.

Existing listing copy, category (Workflow & Planning), English language, and unlisted distribution were documented in `STORE_LISTING.md`; they are historical metadata, not verified dashboard settings. No new listing copy is being submitted in this release. Contact: max@rgcre.com. Homepage: https://www.sshteam.app.

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
- **21 Node regression checks passed**, including payload serialization, all five on-market statuses, all yard tri-state transitions, property modes, original-ID guards, scoped lookup, RPC-only comp writes, suite/portion fields, and transport-vs-rejection handling.
- **13 mounted property-linking scenarios and six existing yard scenarios passed** against source and the extracted 1.3.3 ZIP. Browsers use the real panel and mocked Chrome messages, with external networking blocked. All five listing statuses, R&G/external records, ambiguous choice/Cancel, explicit skip, failed lookup, failed/retried save, committed-but-lost response, panel reload, incomplete response, storage failure, and concurrent clicks are covered.
- Verified no horizontal overflow at 320px and 390px; keyboard selection/save, focus on ambiguous choice, and property-card visibility with older hidden/custom layouts passed. Visual evidence: `/tmp/masterappsurvey-property-choice-390.png` and `/tmp/masterappsurvey-property-legacy-320.png`.
- Live schema read verified every generated comp field and lookup column; `property_id`, `suite`, `partial_site_override`, and `multi_tenant` exist and are nullable. No production business-record writes were made for testing.
- Matching decisions, true concurrent property creation, rollback, and database receipt behavior must be verified by the owning main-app migration tests before release. Extension tests verify its integration contract, not a production save.
- Existing `store-screenshot.jpg` remains historical. The property card and suite controls should be included in a future listing screenshot refresh; local fixture screenshots are not automatically uploaded.
- Package verified: **61,673 bytes**, SHA-256 `9cdce6b6cf9e2f495ebd9637dddae205cccdcf0445804947852100d942466798`; archive integrity passed and all 11 runtime/icon files byte-match source. The extracted package passed the same 21 Node checks and 19 mounted browser scenarios. JavaScript syntax and diff whitespace checks passed.
- **Release still held:** backend production rollout verification and final publication belong to the main property-linking task. No live save or extension installation is claimed from these mock tests.

## Submission evidence and API behavior

The 1.3.2 release used a checked submission path rather than `publish.sh`, which does not gate publication on upload success. Exactly one upload returned HTTP 200 / `SUCCESS`; a subsequent draft read returned `crxVersion: 1.3.2`. Exactly one publication request then returned HTTP 200, `status: ["OK"]`, `statusDetail: ["OK."]`; the final draft read still confirms 1.3.2. The GET response's `uploadState: NOT_FOUND` tracks only uploads that initially returned `IN_PROGRESS`, so it does not contradict this synchronous upload's success. See [Google's v1 resource reference](https://developer.chrome.com/docs/webstore/api/v1). Local credential-free responses are in `/tmp/masterappsurvey-cws-1.3.2-result.json`. No review cancellation, duplicate upload, or duplicate publication was performed.

## Version history

| Version | Date | Change | Status |
|---|---|---|---|
| 1.3.3 | 2026-09-10 | Atomic property linking, visible skip/link states, save recovery, suite/portion controls | Prepared only; backend verification and publication held |
| 1.3.2 | 2026-09-10 | Yard included tri-state comp field | Public Version field and draft API verified 1.3.2 on 2026-09-10 |
| 1.3.1 | 2026-09-10 | Repair comp schema compatibility | Public listing verified 1.3.1; local runtime mismatch unresolved |
| 1.3.0 | 2026-07-28 | Customizable form layout | Installed in Chrome and returned by Web Store API on 2026-09-10 |
