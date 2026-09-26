# 1.4.16 workflow guidance — pending approval

The shared ops-log save is explicitly authorized and will be completed with the verified release outcome. The following playbook/wiki edits are NOT authorized yet. Existing older proposals below remain historical and are not automatically approved.

Destinations:
- `/Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/max-playbook-and-knowledge/master-app/surveys-reference.md`, Chrome Extension section.
- `/Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/max-playbook-and-knowledge/master-app/comps-data-reference.md`, extension capture paragraph (replace obsolete automatic building-area default wording).
- Existing https://www.sshteam.app/wiki/surveys, extension guidance (live content checked).

Proposed concise text:

> In extension 1.4.16, choose For Sale and For Lease independently. In COMP, select a separate Stage; Pending or Closed requires one progressed side. Updates keep saved offerings and stage unless you change them. Missing price or rent does not remove availability, and the destination survey type does not determine a property's offerings. Confirm unresolved source availability before saving. Lease area stays unknown until the offered area is known; use whole-building SF only after confirming whole-premises scope. Deliberate price/rent clears survive re-read and save recovery.

Scope this wording to1.4.16; Google review and installed rollout status belong in the release checkpoint/ops entry, not a claim that all installed copies already changed. No separate change is needed to the Comps and Properties wiki's already-correct independent-offering sentence. Both live wiki pages, both playbook references, and the running ops log were read. Re-read immediately before any approved save to preserve concurrent edits.

---

# Proposed shared updates — pending approval

## Playbook and existing Surveys wiki

Destinations:
- /Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/max-playbook-and-knowledge/master-app/surveys-reference.md
- /Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/wiki/surveys.md
- https://www.sshteam.app/wiki/surveys (live page not checked this turn; re-read before saving)

Add beside the existing extension guidance:
“Widen the Comp panel to arrange related sections side by side, or use Pop out. Feature checkboxes retain Yes, No and Unknown; Clear restores Unknown. Selecting ISF or IOS checks Yard included, which remains editable.”

Replace stale latest-candidate status with:
“Version1.4.13 has been submitted to the existing Chrome Web Store listing. The public listing still showed1.4.0 immediately after submission; Google approval and automatic rollout remain pending. This submission does not update an unpacked installation.”

## Operations log

Prepend to /Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/max-playbook-and-knowledge/archive/ops-2026-09.md and increment September count in /Users/maxschumacher/Library/CloudStorage/OneDrive-Rein&Grossoehme/max-playbook-and-knowledge/ops-changelog.md after checking for duplicates.

## 2026-09-18 — Submit Survey Pusher1.4.13 to Chrome Web Store

**Category:** Web App — Extension release submission
**Records affected:** 0 business records; one existing Store item.

**What changed:** Submitted1.4.13 with wider side-by-side Comp layout, compact top description, feature checkboxes, section and missing-field navigation, reviewed flyer capture and accumulated suite/field fixes. CLI upload returned SUCCESS, verified draft1.4.13, publish returned OK. Existing item hohikcikmjiopimpigebcbdileipbhhc preserved. Public listing still1.4.0 after submission; approval/rollout pending. Store long description and screenshots unchanged. GitHub main and hosted privacy disclosure updated.

**Why:** Reduce scrolling while preserving review, checkbox behavior and separate-space saves.

**Validation:**301 unit tests; responsive/browser regression checks and packaged MV3 worker/panel smoke passed with fixtures. No production business-record writes or installed-copy replacement.

**Rollback:** If needed before approval, cancel the submitted review through the authorized Store workflow; after release, submit a higher-version build restoring the last known-good behavior. Preserve extension identity and local storage. No business-data rollback.

## Additional listing review update — pending approval

Add to the same Surveys playbook and wiki destinations above:
“Extension 1.4.15 reads Sale Notes and Highlights automatically for supported listing details. Choose Review listing and select the evidence-backed changes to use; Update fields edits the draft and Save comp saves it. Narrative facts take precedence over generic property-table facts. A stated office percentage can propose Office SF only with a confirmed offered area; the calculation is shown. Ambiguous suite scope or conflicting claims require review. Other useful narrative details appear as review notes. Automatic analysis uses Anthropic through the signed-in Master App. Version 1.4.15 is a local extension package, not an installed or Store-published update.”

Proposed additional full operations entry (backend deployment verified; save pending approval):

## 2026-09-18 — Add Sale Notes and Highlights analysis for Comp review

**Category:** Web App / Chrome extension. **Records affected:** 0 production business records.

**What changed:** Deployed authenticated listing-analysis endpoint at app019ce50 and prepared extension1.4.15. It reviews24 supported listing fields across Sale Notes/Highlights, prioritizes narrative evidence over generic property facts, and returns quoted suggestions. Office percentage arithmetic is independently checked. Extension reads automatically, but requires selected Apply and separate Save; uncertain scope/conflicts are withheld. Local package not installed or submitted to Store.

**Why:** Brokers put office percentages, door dimensions, power and other material specifications in narrative notes; these should be reviewed across the entire form.

**Validation:**304 extension unit tests;9 new listing browser groups,10 existing flyer groups,5 compact groups and packaged MV3 smoke. Backend21 new tests/typecheck, production401/CORS204 gates and real-model fixture verified15,769 office SF from60%×26,282 and the correct grade-level door over contradictory generic table fields. No production business-record writes.

**Rollback:** Disable use of the new analysis action or restore the prior extension package; existing saved records and the prior flyer-analysis workflow remain independent. Reverting the backend route requires a normal scoped app release.
