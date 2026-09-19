# Privacy Policy — CoStar → Survey Pusher

**Last updated:** September 18, 2026

## Overview
The CoStar → Survey Pusher Chrome extension ("the Extension") is an internal
productivity tool used by Rein & Grossoehme (RGCRE) staff to copy property details
from a CoStar property page into a client survey in the RGCRE master-app
(https://www.sshteam.app), save or update market comps/listings, and link each deal
to its building/site property record. It also updates survey-property statuses.

## Data the Extension reads
- **From CoStar (`*.costar.com`):** the property's address, building size, land area,
  submarket, sale price, lease rate and type, cap rate, year built, clear height,
  office/available SF, labeled loading details, property class, and explicit power,
  rail and dock/truckwell facts, plus the CoStar property ID
  (from the page URL) shown on the CoStar tab you are viewing. The Extension reads
  the rendered page when opened or refreshed, while Survey Push is open to detect
  suite changes, and again before saving to verify the selected space. A popped-out
  editor retains its original source tab. The Extension makes no calls to CoStar's
  APIs and does not crawl CoStar.
- **From the flyer CDN (`*.csgpimgs.com`):** when you click "Attach flyer", the Extension
  downloads the flyer PDF you opened, in order to store it with the survey.
- **From the master-app database (`kavynghiailoduhulytq.supabase.co`):** your surveys and
  the properties in the survey you select, existing market comps, and matching
  building/site property records — used to list surveys, review possible matches,
  and pre-fill the record you choose to update.

## Data the Extension stores
- **Locally in Chrome (`chrome.storage.local`) only:**
  - Your master-app (Supabase) sign-in session tokens, used to read and write on your behalf
  - Your last-used survey and email, for convenience
  - Your form-layout preferences and the backup made when the Survey layout is upgraded
  - Survey drafts and their baseline record, including entered amounts, notes, existing
    client-feedback fields needed to preserve the record, and a short source quote.
    Drafts are separated by signed-in account and survey. They survive sign-out and
    reopening on this device; another account cannot restore them. Drafts remain until
    you clear them in Settings for the current survey or remove the extension. No full
    CoStar page text is stored with these drafts.
  - Your explicit building-flyer choices (building identity and stored flyer link),
    separated by account and survey in the same local workspace. New spaces may
    reuse that link; each space's final attachment is saved only when you save it.
    Stop reusing removes the local default; clearing local survey drafts also
    removes these choices. It does not delete files or other saved attachments.
  - Exact reviewed Survey save requests and stable space IDs while the result is
    uncertain. These remain locked for verification/retry and cannot be discarded
    as ordinary drafts until their outcome is resolved.
  - The reviewed comp fields, selected property-link choice, and retry ID for a save
    whose result has not yet been confirmed. This is retained separately for each
    signed-in email and removed when the save succeeds or is confirmed rejected.
- **Temporarily in Chrome's session memory (`chrome.storage.session`):** when you
  click Pop out, the current form context and unsaved Comp fields move to the new
  window. The handoff is account-scoped, accepts restoration for one minute, and is
  removed after transfer or a handled opening failure. If Chrome interrupts the
  transfer, any remaining copy is cleared when the browser session ends. No sign-in
  tokens are copied into this handoff, and popping out does not save to the server.
- No data is stored on any server operated by the developer.

## Flyer analysis
When you click **Analyze flyer** in Comp mode, the extension sends the attached
flyer link and current listing identity/property fields to the signed-in Master App
at https://www.sshteam.app. The app reads that stored attachment and sends it with
those comparison fields to Anthropic for AI extraction. The extension never holds
an AI-provider API key. Suggested changes and source excerpts are returned for
review; applying them edits the current form only. Business records change only
when you explicitly save the comp. Flyer analysis does not send client messages.

## Listing notes analysis
In Comp mode, reading or refreshing a listing automatically sends its rendered Sale
Notes and Sale Highlights, the listing identity, offered area, scope and current form
values to the signed-in Master App and Anthropic for AI analysis. When a selected
suite is open, only that suite's notes/highlights are used. The full web page is not
sent. Suggestions include source quotations; office area calculated from a stated
percentage is identified as calculated. You choose which changes to apply to the
form. Analysis and applying suggestions do not save business records. No client
messages are sent. You can retry analysis from the panel.

## Data the Extension sends
- Reviewed property fields are written to **your own RGCRE master-app** using the
  sign-in session you authorized when you click Save / Add to survey. Flyer files are
  uploaded to its `survey-files` storage bucket when you click Attach flyer; Save
  then attaches that file to the reviewed property. No client message is sent.
- Saving a comp can link it to an existing building/site or create its property
  record. Ambiguous matches require a choice. A visible skip option leaves the deal
  unlinked. Property creation occurs only during save, never while typing.
- Authentication requests (requesting and verifying your sign-in code) are sent to the
  master-app's Supabase authentication service.

## Authentication
Sign-in uses a one-time code emailed to you by the master-app's authentication service.
The Extension never sees or stores your password.

## Data sharing
The Extension does not sell your data. It moves data between the CoStar page you
are viewing and your RGCRE Master App at your direction. Flyer and automatic listing-notes analysis
also use Anthropic as the Master App's AI processor, as described above.

## Permissions
`storage`, `tabs`, `scripting`, and `sidePanel`, plus host access to `*.costar.com`,
`*.csgpimgs.com`, `www.sshteam.app`, and the master-app Supabase domain — each used solely for the functions
described above.

## Contact
Questions: max@rgcre.com
