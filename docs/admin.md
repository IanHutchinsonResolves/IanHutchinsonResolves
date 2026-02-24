# Admin Usage

## Access
- Add your UID to `ADMIN_UIDS` in `app/src/config.ts`.
- Set `app.admin_uids` via `firebase functions:config:set`.
- The Admin tab appears only for allowlisted UIDs.

## Seed Data
- Open Admin tab and tap “Seed Data”.
- This creates sample businesses, a weekly season, board squares, and rewards.

## Rotate Season
- Tap “Rotate Season” to end the active season and create a new weekly season.
- The board shuffles businesses while keeping free space centered.

## Analytics
- Tap “Load Analytics” to view check-ins, unique users, repeats, and completions.

## QR Links
- Each business lists a QR link.
- Print the link and place it in the store.
