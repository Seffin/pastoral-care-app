# Pastoral Visitation & Member Care App

An offline-first mobile app that helps pastoral staff track who to
visit next, based on how long it's been since last contact — rather
than relying on memory or a paper list.

## Why this exists

Pastoral teams caring for a large congregation can't hold everyone's
status in their heads. This app keeps a continuously-updated list
sorted by **days since last visit** (longest gap first), works fully
offline, and stores all data locally on the phone.

## Mobile App Features

- **100% Offline**: Runs entirely on an embedded SQLite database. No internet required.
- **Dark / Light Mode**: Toggle in Settings. Persists across restarts.
- **Members & Families**: Add individuals or families (with per-person name, age, hospitalization status).
- **Phone & Location**: Store contact number and address/location for each member.
- **Visit Logging**: Log visits with date, time of day (Morning→Late Night), interaction type, notes, and optional financial contribution.
- **Visit History**: View all past visits for any member, sorted newest first.
- **Master List with Filters**: "All", "Pending Visit", "Visited This Month".
- **Priority = Days Since Contact**: Members with the longest gap since their last visit appear first. Everyone has equal priority.
- **Member Status**: Mark members as Active, Vacation, Migrated, or Moved Out. Inactive members are not flagged as overdue.
- **Configurable Gap**: Set the "overdue" threshold (default: 3 months) in Settings.

## Repository layout

```
pastoral-care-app/
├── backend/                 # Node/TypeScript API + PostgreSQL
│   ├── db/schema.sql        # Relational schema (source of truth)
│   ├── src/
│   │   ├── api/             # Express route handlers
│   │   ├── middleware/      # Auth, error handling
│   │   ├── services/        # Priority scoring engine
│   │   ├── utils/           # AES-256-GCM field encryption
│   │   ├── app.ts           # Express app factory
│   │   ├── server.ts        # HTTP server entrypoint
│   │   └── scheduler.ts     # Nightly cron job runner
│   └── tests/                # Jest unit tests
├── mobile/                  # React Native offline-first client
│   ├── db/schema.sql        # Local SQLCipher schema
│   └── src/
│       ├── sync/            # Outbox queue + sync manager
│       ├── security/        # Biometric gate + on-device encryption
│       └── screens/         # Dashboard & Visit Logger UI
├── web/                     # React web dashboard (online-only, shares the same API)
│   └── src/
│       ├── api/             # Fetch client with auto token refresh
│       ├── context/         # Auth context
│       └── pages/           # Login, Dashboard, Member Detail, Visit Logger, Attendance Import
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    └── SECURITY.md
```

## Core algorithm

Every active member gets a `priority_score`:

```
S = (W1 * D_contact) + (W2 * A_absence) + W_urgency
```

| Term         | Meaning                                              |
|--------------|-------------------------------------------------------|
| `D_contact`  | Days since the last logged pastoral contact           |
| `A_absence`  | Consecutive missed core-service events (capped)       |
| `W_urgency`  | Flat bonus per active care flag (e.g. `hospitalized`) |

Weights (`W1`, `W2`, per-flag bonus) live in the `care_rules` table and
are editable without a deploy. See
[`backend/src/services/priorityEngine.ts`](backend/src/services/priorityEngine.ts)
for the implementation and
[`backend/tests/priorityEngine.test.ts`](backend/tests/priorityEngine.test.ts)
for worked examples.

Scores recalculate nightly via `backend/src/scheduler.ts`, and
immediately after any bulk attendance ingestion
(`POST /api/attendance/bulk`).

## Getting started (backend)

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT_SIGNING_SECRET, ENCRYPTION_MASTER_KEY
npm install
node setupDb.js             # Initializes the database and inserts dummy data
npm run dev                 # starts the API on :3000
npm run start:scheduler     # (separate process) nightly priority job
```

Generate an encryption key:

```bash
openssl rand -base64 32
```

```bash
cd mobile
npm install
npm run android -- --mode Release    # Builds a standalone Release APK for Android
```

To install on a connected Android phone, make sure USB Debugging is enabled and run the above build command. It will compile the JavaScript bundle and install the app natively on your device so it can run completely offline.

The mobile client bundles `react-native-sqlcipher-storage` for an
encrypted local database and `react-native-biometrics` /
`react-native-keychain` for the biometric-gated encryption key. See
[`mobile/src/security/encryption.ts`](mobile/src/security/encryption.ts).

## Getting started (web)

```bash
cd web
cp .env.example .env    # optional in dev; Vite proxies /api to localhost:3000
npm install
npm run dev              # http://localhost:5173
```

The web client is **online-only** — it talks directly to the same
backend API as the mobile app (no local SQLCipher/offline outbox on
the browser side). It covers the priority dashboard, member detail
and visit history, a visit logger, and a CSV-paste attendance import
tool aimed at desktop use (bulk imports are awkward on mobile).

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system diagram, offline-sync flow, conflict resolution
- [`docs/API.md`](docs/API.md) — endpoint reference
- [`docs/SECURITY.md`](docs/SECURITY.md) — encryption, key management, biometric auth, compliance notes

## Status

This is a scaffolded starting point: schema, priority engine (with
tests), core API routes, the offline outbox/sync manager, and two key
screens are implemented. Still to build out before production: full
CRUD coverage for households/admin screens, push notifications for
overdue follow-ups, structured audit logging, and a CI pipeline.
