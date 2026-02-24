# Setup Guide

## 1) Prerequisites
- Install Node.js 18+
- Install the Firebase CLI: `npm install -g firebase-tools`
- Install the Expo CLI: `npm install -g expo`

## 2) Firebase Console Setup (Clicks)
1. Create a Firebase project in the Firebase console.
2. In Build -> Authentication -> Sign-in method, enable Anonymous.
3. In Build -> Firestore Database, create a Firestore database in production or test mode.
4. In Project Settings -> General -> Your apps, add a new Web app and copy the Firebase config.

## 3) Firebase CLI Init (Commands)
Run these commands from the repo root:

```bash
firebase login
firebase use --add
firebase init
```

During `firebase init`:
- Select `Functions` and `Firestore`.
- Choose TypeScript for functions.
- Use the existing `functions` folder.
- Accept prompts for installing dependencies.

## 4) Configure Secrets and Admin UIDs
1. Update `app/src/config.ts` with your Firebase web config and admin UID(s).
2. Set Cloud Functions config:

```bash
firebase functions:config:set token.secret="YOUR_STRONG_SECRET" app.admin_uids="UID1,UID2"
```

3. Pull config for local emulation (optional):

```bash
firebase functions:config:get > functions/.runtimeconfig.json
```

## 5) Install Dependencies (Commands)
```bash
cd /Users/hutchstuff/Documents/New\ project/app
npm install

cd /Users/hutchstuff/Documents/New\ project/functions
npm install
```

## 6) Deploy Functions and Firestore Rules (Commands)
```bash
cd /Users/hutchstuff/Documents/New\ project
firebase deploy --only functions,firestore
```

## 7) Seed Data (Commands)
Option A: Seed via CLI script
```bash
cd /Users/hutchstuff/Documents/New\ project/functions
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export ADMIN_UIDS="YOUR_UID"
npm run seed
```

Option B: Seed via the Admin screen in the app
- Run the app, open the Admin tab, and tap “Seed Data”.

## 8) Run the Expo App (Commands)
```bash
cd /Users/hutchstuff/Documents/New\ project/app
npm start
```

## 9) Generate Printable QR Links
- Use the Admin tab to view QR links for each business.
- Print the QR link per business. The link resolves to the current daily signed token.
