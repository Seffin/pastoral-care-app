# Architecture

## System overview

```
┌─────────────────────┐        HTTPS (JWT)        ┌──────────────────────┐
│   Mobile Client      │ ─────────────────────────▶ │   API Server (Node)  │
│   (React Native)     │ ◀───────────────────────── │   Express + pg pool  │
│                       │                            │                      │
│  ┌─────────────────┐ │                            │  ┌────────────────┐  │
│  │ SQLCipher local  │ │                            │  │  PostgreSQL     │  │
│  │ DB (encrypted)   │ │                            │  │  (encrypted     │  │
│  │  - members cache │ │                            │  │   PII columns)  │  │
│  │  - visits (local) │ │                            │  │                │  │
│  │  - outbox queue  │ │                            │  └────────────────┘  │
│  └─────────────────┘ │                            │                      │
│  SyncManager ─────────┼──── drains outbox ────────▶│  /api/visits, etc.   │
│  Biometric gate       │                            │                      │
└─────────────────────┘                            │  Nightly Scheduler   │
                                                      │  → priorityEngine    │
                                                      └──────────────────────┘
```

## Web client

The `web/` app is a thin, online-only React client against the same
REST API — no separate backend logic. It's the right place for
desktop-shaped work the mobile app doesn't optimize for (bulk
attendance CSV import, reviewing a member's full visit history on a
larger screen). It reuses the exact same idempotency mechanism as
mobile for visit logging (`clientGeneratedId`, generated with
`crypto.randomUUID()`), even though it doesn't need an offline queue,
so a double-submit from a flaky connection or an accidental double
click can't create a duplicate visit.

Tokens are kept in `sessionStorage` rather than `localStorage` —
cleared when the tab closes, refreshed transparently on a 401 via
`apiRequest`'s retry-once logic in `web/src/api/client.ts`.

## Offline-first write path (mobile)

1. User logs a visit while offline. The screen calls a local repository
   function that:
   - Writes the row directly into the local `visits` table (optimistic,
     immediately visible in the UI).
   - Calls `SyncManager.queueMutation('visit', id, 'create', payload)`,
     which durably appends a record to the `outbox` table.
2. `SyncManager.processOutbox()` is invoked whenever connectivity is
   regained (NetInfo listener), on app foreground, and on a periodic
   timer as a safety net.
3. Each outbox item is pushed to the API **in FIFO order**. The visit
   endpoint is idempotent on `client_generated_id`, so a retried push
   (e.g. the device lost signal right after the server accepted the
   write, before the response arrived) is deduplicated server-side
   rather than creating a second visit.
4. On success, the local row is marked `sync_status = 'synced'` and the
   outbox item is deleted. On failure, the item stays queued with
   exponential backoff (`backend`/`mobile` share the same idea — see
   `computeBackoffMs` in `mobile/src/sync/syncManager.ts`).

## Conflict resolution

Most writes in this domain (a visit, an attendance mark) are
append-only or owned by a single author, so true conflicts are rare.
Where they can occur — two staff editing the same member's profile
while both offline — the default strategy is **server-wins,
last-write-by-server-timestamp**. `SyncManager` exposes an optional
`onConflict` callback so call sites that need finer-grained behavior
(e.g. never silently discard a visit note; instead keep both as
separate log entries) can override the default.

## Nightly priority recalculation

`backend/src/scheduler.ts` runs as an independent process from the API
server so a long recalculation pass (large congregations) can't block
request handling. It:

1. Loads current weights from `care_rules`.
2. For every active member, pulls their most recent N attendance
   records and computes `scoreMember(...)` (a pure function, unit
   tested independently of the DB).
3. Persists `priority_score` + `priority_updated_at` in a single
   transaction.

The same recalculation also runs synchronously after
`POST /api/attendance/bulk`, so a Sunday check-in import updates the
dashboard immediately rather than waiting until 2 AM.

## Why SQLCipher + field-level AES-256 (two layers)

- SQLCipher protects the **file at rest** — if a device is lost or a
  raw file backup is extracted, the whole DB is unreadable without the
  keystore-held key.
- Field-level AES-256-GCM protects **specific columns** independently,
  so PII (phone, address, notes) stays encrypted even in scenarios
  where the SQLCipher key is available but a specific field shouldn't
  be — e.g. exporting the DB for a schema migration tool, or a bug
  that logs a full row.

Full trust-boundary details are in `docs/SECURITY.md`.
