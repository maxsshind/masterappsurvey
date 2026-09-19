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
