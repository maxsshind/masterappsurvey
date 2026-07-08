# Chrome Web Store listing — CoStar → Survey Pusher

**Package to upload:** `/Users/maxschumacher/Developer/masterappsurvey/masterappsurvey-v1.0.0.zip`

## Store listing tab
- **Name:** CoStar → Survey Pusher
- **Summary (132 char max):** Push the CoStar property on your screen into a master-app survey, then update its status — right from a side panel.
- **Category:** Workflow & Planning
- **Language:** English

**Description:**
```
Internal R&G tool. While browsing a CoStar property page, this side panel reads the property (address, building SF, land acres, sale price, lease rate/type, cap rate) and pushes it into a survey in the master-app. Pick an existing survey or create one on the fly, attach the CoStar flyer PDF, and update availability/status on properties already in a survey — without leaving CoStar.
```

## Privacy tab
- **Single purpose:** Capture the CoStar property record currently on screen and add or update it in the user's master-app survey.
- **Permission justifications:**
  - `storage` — store the user's sign-in session and last-used survey locally.
  - `tabs` — detect which CoStar property page is active and find the open flyer PDF tab.
  - `scripting` — read the visible text of the active CoStar tab to extract property fields (read-only, on user action).
  - `sidePanel` — the entire UI is a docked side panel.
  - Host `*.costar.com` — read the property page the user is viewing.
  - Host `*.csgpimgs.com` — download the flyer PDF the user opened, to store it with the survey.
  - Host `kavynghiailoduhulytq.supabase.co` — the master-app database/storage the properties are saved to.
- **Data usage:** does not sell or transfer data; used only to perform the user's requested save into their own master-app.
- **Privacy policy URL:** (reuse the costarpull privacy policy URL, or a simple one-pager — ask if you need one generated.)

## Distribution tab
- **Visibility: Unlisted** (team-only; installs from the direct link, not searchable/public).
```
