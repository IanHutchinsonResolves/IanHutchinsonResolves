# Architecture Overview

## High-Level Flow
- The app signs users in anonymously.
- The app reads the active season, board squares, and business list.
- Users scan a QR code in a store.
- The QR link returns a signed daily token from Cloud Functions.
- The app calls `validateCheckIn` to earn a square and issue rewards.
- Admins use Cloud Functions for seeding, season rotation, and analytics.

## Token and Validation
- Tokens are HMAC-signed with `TOKEN_SECRET`.
- Payload includes `businessId`, `tokenDate`, and `nonce`.
- `tokenDate` must match “today” in `America/Los_Angeles`.

## Rate Limiting
- One check-in per user per business per 24 hours.
- Enforced in `validateCheckIn` before writes.

## Rewards
- Row completion rewards are issued once per row per season.
- Full board completion issues a raffle entry and a board reward record.

## Analytics
- Aggregated in `adminGetAnalytics` by scanning season check-ins and progress.
- For large scale, move counts to scheduled aggregations.

## Cost and Performance Notes
- `adminGetAnalytics` reads all check-ins for the active season. This is fine for MVP volume but costs more as data grows.
- For scale, create a scheduled Cloud Function that writes daily aggregates to a dedicated collection.
