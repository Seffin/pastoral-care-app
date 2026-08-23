-- =====================================================================
-- Pastoral Care App — Local Mobile Schema (SQLite via SQLCipher)
-- =====================================================================
-- The entire database FILE is encrypted at rest by SQLCipher (PRAGMA key
-- set at connection open, backed by a key stored in Keychain/Keystore —
-- see mobile/src/security/encryption.ts). Individual sensitive columns
-- are ALSO stored as application-layer AES-256-GCM ciphertext (blob),
-- so PII is protected even if the SQLCipher key were ever compromised
-- or the file were extracted from an unlocked device.
--
-- SQLite has no native UUID type: store as TEXT (36-char canonical form).
-- =====================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
    id                  TEXT PRIMARY KEY,          -- UUID, mirrors server id once synced
    full_name           TEXT NOT NULL,
    encrypted_phone      BLOB,
    encrypted_address     BLOB,
    encryption_iv        BLOB,
    household_id        TEXT,
    membership_status   TEXT NOT NULL DEFAULT 'active',
    date_of_birth       TEXT,                       -- ISO date string
    joined_at           TEXT,
    assigned_pastor_id  TEXT,
    care_flags          TEXT NOT NULL DEFAULT '[]',  -- JSON array, e.g. ["hospitalized"]
    last_contacted_at   TEXT,
    priority_score       REAL NOT NULL DEFAULT 0,
    priority_updated_at TEXT,
    is_active           INTEGER NOT NULL DEFAULT 1,
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    -- offline-first bookkeeping
    dirty                INTEGER NOT NULL DEFAULT 0,   -- 1 = local change not yet synced
    server_updated_at   TEXT                          -- last-known server version, for conflict detection
);

CREATE INDEX IF NOT EXISTS idx_local_members_priority ON members (priority_score DESC) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS attendance (
    id                  TEXT PRIMARY KEY,
    member_id           TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    event_date          TEXT NOT NULL,
    event_type          TEXT NOT NULL DEFAULT 'sunday_service',
    was_present         INTEGER NOT NULL,
    recorded_by         TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    dirty                INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_local_attendance_member ON attendance (member_id, event_date DESC);

CREATE TABLE IF NOT EXISTS visits (
    id                  TEXT PRIMARY KEY,           -- client_generated_id, becomes canonical id
    member_id           TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visited_by          TEXT NOT NULL,
    interaction_type    TEXT NOT NULL,
    encrypted_notes       BLOB,
    encryption_iv        BLOB,
    occurred_at          TEXT NOT NULL DEFAULT (datetime('now')),
    next_follow_up_date  TEXT,
    sync_status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'synced' | 'conflict' | 'error'
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_local_visits_status ON visits (sync_status);

-- ---------------------------------------------------------------------
-- outbox: durable queue of local mutations awaiting sync.
-- Decoupling the outbox from the entity tables lets us replay actions
-- in order and retry individual operations without re-scanning every
-- table for "dirty" rows.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outbox (
    id                  TEXT PRIMARY KEY,           -- UUID for this queued operation
    entity_type         TEXT NOT NULL,               -- 'member' | 'attendance' | 'visit'
    entity_id           TEXT NOT NULL,
    operation           TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    payload             TEXT NOT NULL,               -- JSON snapshot of the change
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    attempt_count       INTEGER NOT NULL DEFAULT 0,
    last_attempt_at     TEXT,
    last_error          TEXT,
    status              TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_flight', 'failed', 'done'))
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox (status, created_at);

-- Local cache of care_rules so priority scoring works fully offline
CREATE TABLE IF NOT EXISTS care_rules (
    rule_key            TEXT PRIMARY KEY,
    rule_value          REAL NOT NULL,
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tracks the last successful full/delta sync for each entity type
CREATE TABLE IF NOT EXISTS sync_state (
    entity_type         TEXT PRIMARY KEY,
    last_synced_at      TEXT,
    last_cursor         TEXT                          -- opaque server pagination/delta cursor
);
