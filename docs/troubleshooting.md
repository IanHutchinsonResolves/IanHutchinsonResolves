# Troubleshooting

## “TOKEN_SECRET is not configured”
- Run: `firebase functions:config:set token.secret="YOUR_STRONG_SECRET"`
- Redeploy: `firebase deploy --only functions`

## Admin screen not visible
- Confirm your UID is in `ADMIN_UIDS` in `app/src/config.ts`.
- Confirm your UID is in `app.admin_uids` via Firebase config.

## “No active season yet”
- Use Admin -> Seed Data, or run `npm run seed` in `/functions`.

## “You can only check in once per business every 24 hours”
- This is expected; wait 24 hours since the last check-in for that business.

## QR scan says “Token not found”
- Confirm the QR link points to `/getDailyToken?businessId=...`.
- Check the business ID exists in Firestore.
