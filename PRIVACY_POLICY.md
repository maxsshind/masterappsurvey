# Privacy Policy — CoStar → Survey Pusher

**Last updated:** September 10, 2026

## Overview
The CoStar → Survey Pusher Chrome extension ("the Extension") is an internal
productivity tool used by Rein & Grossoehme (RGCRE) staff to copy property details
from a CoStar property page into a client survey in the RGCRE master-app
(https://www.sshteam.app), save or update market comps/listings, and link each deal
to its building/site property record. It also updates survey-property statuses.

## Data the Extension reads
- **From CoStar (`*.costar.com`):** the property's address, building size, land area,
  submarket, sale price, lease rate and type, cap rate, and the CoStar property ID
  (from the page URL) shown on the CoStar tab you are actively viewing. Read only when
  you open the extension or click Read, and only from the rendered page already on your
  screen. The Extension makes no calls to CoStar's APIs and does not crawl CoStar.
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
  - Your form-layout preferences
  - The reviewed comp fields, selected property-link choice, and retry ID for a save
    whose result has not yet been confirmed. This is retained separately for each
    signed-in email and removed when the save succeeds or is confirmed rejected.
- No data is stored on any server operated by the developer.

## Data the Extension sends
- Property fields and flyer PDFs are written to **your own RGCRE master-app** (its Supabase
  database and the `survey-files` storage bucket), using the sign-in session you authorized,
  and only after you review the record and click Save / Add to survey.
- Saving a comp can link it to an existing building/site or create its property
  record. Ambiguous matches require a choice. A visible skip option leaves the deal
  unlinked. Property creation occurs only during save, never while typing.
- Authentication requests (requesting and verifying your sign-in code) are sent to the
  master-app's Supabase authentication service.

## Authentication
Sign-in uses a one-time code emailed to you by the master-app's authentication service.
The Extension never sees or stores your password.

## Data sharing
The Extension does not sell or transfer your data to third parties. It moves data only
between the CoStar page you are viewing and your own RGCRE master-app, at your direction.

## Permissions
`storage`, `tabs`, `scripting`, and `sidePanel`, plus host access to `*.costar.com`,
`*.csgpimgs.com`, and the master-app Supabase domain — each used solely for the functions
described above.

## Contact
Questions: max@rgcre.com
