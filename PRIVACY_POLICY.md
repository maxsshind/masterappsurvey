# Privacy Policy — CoStar → Survey Pusher

**Last updated:** July 8, 2026

## Overview
The CoStar → Survey Pusher Chrome extension ("the Extension") is an internal
productivity tool used by Rein & Grossoehme (RGCRE) staff to copy property details
from a CoStar property page into a client survey in the RGCRE master-app
(https://www.sshteam.app), and to update the status of properties already in a survey.

## Data the Extension reads
- **From CoStar (`*.costar.com`):** the property's address, building size, land area,
  submarket, sale price, lease rate and type, cap rate, and the CoStar property ID
  (from the page URL) shown on the CoStar tab you are actively viewing. Read only when
  you open the extension or click Read, and only from the rendered page already on your
  screen. The Extension makes no calls to CoStar's APIs and does not crawl CoStar.
- **From the flyer CDN (`*.csgpimgs.com`):** when you click "Attach flyer", the Extension
  downloads the flyer PDF you opened, in order to store it with the survey.
- **From the master-app database (`kavynghiailoduhulytq.supabase.co`):** your surveys and
  the properties in the survey you select — used to list surveys, avoid duplicates, and
  pre-fill the record you choose to update.

## Data the Extension stores
- **Locally in Chrome (`chrome.storage.local`) only:**
  - Your master-app (Supabase) sign-in session tokens, used to read and write on your behalf
  - Your last-used survey and email, for convenience
- No data is stored on any server operated by the developer.

## Data the Extension sends
- Property fields and flyer PDFs are written to **your own RGCRE master-app** (its Supabase
  database and the `survey-files` storage bucket), using the sign-in session you authorized,
  and only after you review the record and click Save / Add to survey.
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
