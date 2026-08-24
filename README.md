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
- **Visit Logging**: Log visits with a fast **scrollable date ribbon** (Today, Yesterday, past 30 days) and a **Modern 3-Wheel Scrollable Date Picker Modal** (Day, Month, Year wheel selectors), time of day (Morning→Late Night), interaction type (In-Person, Call, Video, Text, Other), and pastoral notes.
- **Visit History**: View all past visits for any member, sorted newest first.
- **Master List with Filters**: "All", "Pending Visit", "Visited This Month".
- **Priority = Days Since Contact**: Members with the longest gap since their last visit appear first. Everyone has equal priority.
- **Instant Status Sync**: Logging a visit immediately updates the member's last-contacted timestamp, moves them from "Pending Visit" to "Visited This Month", and clears overdue flags.
- **Member Status**: Mark members as Active, Vacation, Migrated, or Moved Out. Inactive members are not flagged as overdue.
- **Configurable Gap**: Set the "overdue" threshold (default: 3 months) in Settings.
- **Resilient Database Init**: Automatic table provisioning with error diagnostics and retry recovery.

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
│   └── tests/               # Jest unit tests
├── mobile/                  # React Native offline-first client
│   ├── db/schema.sql        # Local SQLCipher schema
│   └── src/
│       ├── db/              # Local SQLite database & migrations
│       ├── sync/            # Outbox queue + sync manager
│       ├── security/        # Biometric gate + on-device encryption
│       └── screens/         # Dashboard, Member & Visit Logger UI
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

## Getting started (mobile build & run)

### 1. Build and Install Automatically on Connected Device
```bash
cd mobile
npm install
npm run android -- --mode Release
```

### 2. Build Release APK Manually (via Windows CMD / Terminal)
```cmd
cd mobile\android
gradlew.bat assembleRelease
```
The output APK is generated at:
`mobile\android\app\build\outputs\apk\release\app-release.apk`

To install the generated APK on a connected phone via ADB:
```cmd
:: If 'adb' is not recognized in CMD, add platform-tools to PATH in your current window:
set PATH=%PATH%;C:\Users\%USERNAME%\AppData\Local\Android\Sdk\platform-tools

:: Install APK onto connected device:
adb install -r app\build\outputs\apk\release\app-release.apk
```

### 3. Run in Debug Mode (with Metro Hot Reload)
1. In Terminal 1:
   ```cmd
   cd mobile
   npm start
   ```
2. In Terminal 2:
   ```cmd
   cd mobile
   npm run android
   ```

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
tests), core API routes, the offline outbox/sync manager, and all key
mobile screens (Dashboard, All Members, Add/Edit Member, Visit Logger, Visit History, Settings) are implemented.
