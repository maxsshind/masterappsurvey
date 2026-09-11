# Chrome Web Store — CoStar → Survey Pusher

Last updated: 2026-09-10

## Release

- Item: `hohikcikmjiopimpigebcbdileipbhhc`
- [Store listing](https://chromewebstore.google.com/detail/hohikcikmjiopimpigebcbdileipbhhc)
- Package: `masterappsurvey-v1.3.2.zip`
- Scope: add optional Yard included (Yes / No / Unknown) to comp insert/update and existing-comp lookup; preserve 1.3.1 schema compatibility.
- Current status: **1.3.2 submitted successfully** on September 10, 2026. Upload HTTP 200 / `SUCCESS`; publication HTTP 200 / `OK`; post-publication draft version 1.3.2. Public listing still 1.3.1 at 20:12 Arizona time; public availability of 1.3.2 remains unverified.
- Installed Chrome runtime last verified **1.3.0** while its loaded manifest file reports 1.3.1. This cached-version mismatch remains unresolved. The active unpacked installation is not being changed by the 1.3.2 store release.
- [Technical release notes](/Users/maxschumacher/Developer/masterappsurvey/CHANGELOG.md). Existing store description, screenshots, privacy disclosures, distribution, and permissions are unchanged by this package update.

## Store listing and purpose

Name: CoStar → Survey Pusher

Manifest description: Push the CoStar property on your screen into a master-app survey or the comps database. Read-only on CoStar.

Purpose: review the open CoStar property's details and save or update that property in RGCRE surveys or market comps.

New comp feature: record whether yard is included with the offered space/site as Yes, No, or Unknown; preserve that answer when re-reading CoStar. Notes hold yard details and differences between sale and lease offers.

Existing listing copy, category (Workflow & Planning), English language, and unlisted distribution were documented in `STORE_LISTING.md`; they are historical metadata, not verified dashboard settings. No new listing copy is being submitted in this release. Contact: max@rgcre.com. Homepage: https://www.sshteam.app.

## Permissions and data use

| Permission | Reason |
|---|---|
| `storage` | Retain sign-in session, last survey, and form layout preferences locally. |
| `tabs` | Identify the open CoStar property and its flyer tab. |
| `scripting` | Read property details from the page the user is viewing. |
| `sidePanel` | Show the review-and-save form beside CoStar. |
| `https://*.costar.com/*` | Read the current property page. |
| `https://*.csgpimgs.com/*` | Retrieve the flyer selected by the user. |
| `https://kavynghiailoduhulytq.supabase.co/*` | Sign in and read/save the user's Master App records and flyers. |

Data includes the user's sign-in email/session, selected property details, listing contacts entered by the user, and selected flyer PDFs. These support the requested Master App workflow. No new data collection, remote code, analytics, hosts, or permissions are introduced. Existing local privacy source: `PRIVACY_POLICY.md`. The public listing links to [the hosted privacy policy](https://github.com/maxsshind/masterappsurvey/blob/main/PRIVACY_POLICY.md), verified HTTP 200 with session-token disclosure. Dashboard disclosure selections were not independently inspected.

## Assets and validation

- Manifest V3, no permission changes.
- Icon files verified: 16×16, 48×48, 128×128 PNGs.
- Existing screenshot: `store-screenshot.jpg`; no screenshot replacement included. The new Yard control is documented by local mocked-form screenshots `/tmp/masterappsurvey-yard-default.png` and `/tmp/masterappsurvey-yard-legacy.png`; store screenshots should include it in a future listing refresh.
- ZIP contains only extension runtime files and icons; no credentials, tests, or release documentation.
- Nine regression checks passed against both source and the extracted ZIP, including all three yard insert values and all nine update transitions. Six mounted browser scenarios also passed against source and the extracted ZIP, using real panel controls, mocked Chrome messages, and blocked external networking. Every generated record field and lookup column was checked against the live schema.
- Package: 56,459 bytes, SHA-256 `79fb33586b7734e6ac92f62af0eb5168949ec52fa388355adb0725d9486077f7`. Archive integrity passed and all 11 runtime/icon files byte-match source; JavaScript syntax and diff whitespace checks passed.
- Corrected live REST lookup succeeds (HTTP 200); old lookup fails (HTTP 400).
- Prior Chrome checks verified retained authentication, save payload without `type`, and successful authenticated duplicate lookup. Runtime briefly reported 1.3.1 but reverted to 1.3.0 on reload despite manifest-file version 1.3.1. The installed version is unresolved. Real save remains untested; no live comp data changed.
- Local installation uses `local-extension/` with the existing store public key/ID. The pending comp draft was preserved/restored. This is an unpacked installation, so returning to normal store updates requires a later switch back after store rollout is verified.

## Submission evidence and API behavior

The 1.3.2 release used a checked submission path rather than `publish.sh`, which does not gate publication on upload success. Exactly one upload returned HTTP 200 / `SUCCESS`; a subsequent draft read returned `crxVersion: 1.3.2`. Exactly one publication request then returned HTTP 200, `status: ["OK"]`, `statusDetail: ["OK."]`; the final draft read still confirms 1.3.2. The GET response's `uploadState: NOT_FOUND` tracks only uploads that initially returned `IN_PROGRESS`, so it does not contradict this synchronous upload's success. See [Google's v1 resource reference](https://developer.chrome.com/docs/webstore/api/v1). Local credential-free responses are in `/tmp/masterappsurvey-cws-1.3.2-result.json`. No review cancellation, duplicate upload, or duplicate publication was performed.

## Version history

| Version | Date | Change | Status |
|---|---|---|---|
| 1.3.2 | 2026-09-10 | Yard included tri-state comp field | Submitted: upload SUCCESS, publication OK, draft 1.3.2; public listing still 1.3.1 |
| 1.3.1 | 2026-09-10 | Repair comp schema compatibility | Public listing verified 1.3.1; local runtime mismatch unresolved |
| 1.3.0 | 2026-07-28 | Customizable form layout | Installed in Chrome and returned by Web Store API on 2026-09-10 |
