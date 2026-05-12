# ICAC P.U.L.S.E. v2.3.3 Release Notes

## New Features

### Custom Metrics (Viper-style)
Define your own tracked fields and surface them across the app.

- **Settings → Custom Metrics** — Add/edit/delete metrics with name, type, and color
  - **Counter** — numeric, sums across cases
  - **Checkbox** — yes/no, counts cases marked yes
  - **Date** — counts cases with a date set
  - **Text** — counts cases with text entered
- **Case Overview tab** — Per-case editor renders all defined metrics
- **Dashboard Quick Stats** — Settings cog lets you pick which built-in stats and custom metrics to display, and in what order. Custom metric tiles show total + monthly contribution.

Storage is local-only (localStorage), Viper-compatible schema.

## Fixes

### Warrant & Evidence ZIP / Folder Uploads
- Warrant Returns now accept ZIP files and full folders (zipped or unzipped)
- Evidence intake unzips ZIP archives before parsing
- DataPilot scanner auto-extracts ZIP input

### UC Chat Operations
- **Per-profile chats** — Switching personas now shows only that profile's chats
- **Linked-case banner** — When a chat is linked to a case, the case number, title, and status are displayed across the top of the chat panel with a quick "Change" button

## Known / Non-issues
- "ICACCops not loading" reported on one laptop is environmental (works correctly on the same user's USB install). No code change.
