# API Reference

Base URL: `https://<your-domain>/api`
All endpoints except `/auth/*` require `Authorization: Bearer <accessToken>`.

## Auth

### `POST /auth/login`
```json
// Request
{ "email": "pastor@church.org", "password": "..." }

// 200 Response
{ "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }
```
Rate-limited to 10 requests / 15 min per IP. Returns `401
invalid_credentials` for both unknown emails and wrong passwords
(constant response shape to avoid user enumeration).

### `POST /auth/refresh`
```json
{ "refreshToken": "..." }
```
Returns a new short-lived (`15m`) `accessToken`.

---

## Members

### `GET /members?limit=&offset=&status=active`
Dashboard listing, **always sorted by `priority_score DESC`**.
Returns lightweight fields only (no decrypted PII) — safe for a list view.

```json
{
  "members": [
    {
      "id": "uuid",
      "full_name": "Jane Doe",
      "membership_status": "active",
      "care_flags": ["hospitalized"],
      "last_contacted_at": "2026-07-01T10:00:00Z",
      "priority_score": 245.0,
      "assigned_pastor_id": "uuid"
    }
  ],
  "limit": 50,
  "offset": 0
}
```

### `GET /members/:id`
Full detail view — decrypts `phone` and `address` server-side for
display. Requires the caller's role to be authorized (enforce
`requireRole` per your ministry's access policy; currently open to any
authenticated user — tighten before production).

### `POST /members`
Creates a member. `phone`/`address` are encrypted before insert.

```json
{
  "fullName": "Jane Doe",
  "phone": "+1-555-0100",
  "address": "123 Main St",
  "membershipStatus": "active",
  "careFlags": [],
  "assignedPastorId": "uuid"
}
```

---

## Visits

### `POST /visits`
Logs a pastoral contact. **Idempotent** on `clientGeneratedId` — safe
to retry from the mobile offline outbox.

```json
{
  "memberId": "uuid",
  "interactionType": "in_person",
  "notes": "Prayed together, follow up next week",
  "occurredAt": "2026-08-20T18:30:00Z",
  "nextFollowUpDate": "2026-08-27",
  "clientGeneratedId": "uuid-generated-on-device"
}
```

Response: `{ "id": "uuid", "deduplicated": false }`. On retry of an
already-processed `clientGeneratedId`: `{ "id": "uuid", "deduplicated": true }`,
HTTP 200 (not 201).

Logging a visit updates `members.last_contacted_at`, which feeds
directly into the next priority recalculation.

### `GET /visits/member/:memberId`
Last 100 visits for a member, newest first.

---

## Attendance

### `POST /attendance/bulk`
Ingests one event's full roster in a single transaction, then
synchronously triggers a full priority recalculation.

```json
{
  "eventDate": "2026-08-16",
  "eventType": "sunday_service",
  "records": [
    { "memberId": "uuid-1", "wasPresent": true },
    { "memberId": "uuid-2", "wasPresent": false }
  ]
}
```

Response: `{ "ingested": 2, "priorityScoresUpdated": 340 }`.

For congregations large enough that this blocks the request
noticeably, move the recalculation into a background queue (see note
in `attendance.routes.ts`).

---

## Error shape

All errors follow `{ "error": "<machine_readable_code>", "details"?: {...} }`
with an appropriate HTTP status. Unhandled exceptions return a generic
`500 internal_server_error` with no stack trace or internal detail
leaked to the client (see `middleware/errorHandler.ts`).
