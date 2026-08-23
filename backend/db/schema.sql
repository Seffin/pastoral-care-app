-- =====================================================================
-- Pastoral Visitation & Member Care App — PostgreSQL Schema
-- =====================================================================
-- Notes:
--   * UUID primary keys via pgcrypto's gen_random_uuid()
--   * Sensitive PII (phone, address, free-text notes) is stored as
--     bytea and encrypted at the application layer with AES-256-GCM
--     before it ever reaches this database (see backend/src/utils/encryption.ts).
--     This schema never sees plaintext PII.
--   * Timestamps are timestamptz and default to now() in UTC.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- users: pastors / staff / admins who use the app
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               CITEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,               -- argon2id hash, never plaintext
    full_name           TEXT NOT NULL,
    role                TEXT NOT NULL DEFAULT 'staff' -- 'admin' | 'pastor' | 'staff'
                            CHECK (role IN ('admin', 'pastor', 'staff')),
    biometric_enrolled  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- members: congregation members being cared for
-- ---------------------------------------------------------------------
CREATE TABLE members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name           TEXT NOT NULL,                -- treated as low-sensitivity; encrypt too if policy requires
    encrypted_phone      BYTEA,                        -- AES-256-GCM ciphertext
    encrypted_address     BYTEA,                        -- AES-256-GCM ciphertext
    encryption_iv        BYTEA,                         -- per-record IV/nonce (see encryption.ts for key/IV strategy)
    household_id        UUID,                          -- optional grouping of family members
    membership_status   TEXT NOT NULL DEFAULT 'active'
                            CHECK (membership_status IN ('active', 'inactive', 'visitor', 'transferred', 'deceased')),
    date_of_birth       DATE,
    joined_at           DATE,
    assigned_pastor_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    care_flags          TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {'hospitalized','bereaved','new_member'}
    last_contacted_at   TIMESTAMPTZ,                   -- denormalized for fast dashboard sorting
    priority_score       NUMERIC(10,4) NOT NULL DEFAULT 0,
    priority_updated_at TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_members_priority_score ON members (priority_score DESC) WHERE is_active = TRUE;
CREATE INDEX idx_members_assigned_pastor ON members (assigned_pastor_id);
CREATE INDEX idx_members_last_contacted ON members (last_contacted_at);

-- ---------------------------------------------------------------------
-- attendance: per-event attendance records used to compute absence
-- ---------------------------------------------------------------------
CREATE TABLE attendance (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id           UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    event_date          DATE NOT NULL,
    event_type          TEXT NOT NULL DEFAULT 'sunday_service'
                            CHECK (event_type IN ('sunday_service', 'midweek', 'small_group', 'special_event')),
    was_present         BOOLEAN NOT NULL,
    recorded_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (member_id, event_date, event_type)
);

CREATE INDEX idx_attendance_member_date ON attendance (member_id, event_date DESC);

-- ---------------------------------------------------------------------
-- visits: logged pastoral contacts (in person, call, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE visits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id           UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    visited_by          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    interaction_type    TEXT NOT NULL
                            CHECK (interaction_type IN ('in_person', 'phone_call', 'video_call', 'text_message', 'other')),
    encrypted_notes       BYTEA,                        -- AES-256-GCM ciphertext of free-text notes
    encryption_iv        BYTEA,
    occurred_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_follow_up_date  DATE,
    -- offline-first bookkeeping
    client_generated_id  UUID,                          -- id assigned on-device before sync, for idempotency
    sync_status          TEXT NOT NULL DEFAULT 'synced'
                            CHECK (sync_status IN ('synced', 'pending', 'conflict')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (client_generated_id)
);

CREATE INDEX idx_visits_member ON visits (member_id, occurred_at DESC);
CREATE INDEX idx_visits_follow_up ON visits (next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;

-- ---------------------------------------------------------------------
-- care_rules: configurable weights/thresholds for the priority engine
-- ---------------------------------------------------------------------
CREATE TABLE care_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key            TEXT UNIQUE NOT NULL,           -- e.g. 'weight_days_since_contact'
    rule_value          NUMERIC(10,4) NOT NULL,
    description         TEXT,
    updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default weights for S = (W1 * D_contact) + (W2 * A_absence) + W_urgency
INSERT INTO care_rules (rule_key, rule_value, description) VALUES
    ('weight_days_since_contact', 1.0, 'Weight (W1) applied per day since last pastoral contact'),
    ('weight_consecutive_absences', 15.0, 'Weight (W2) applied per consecutive missed core service'),
    ('urgency_flag_bonus', 100.0, 'Flat bonus (W_urgency) added per active care flag (e.g. hospitalized)'),
    ('absence_lookback_events', 8, 'Number of most recent core-service events considered for absence streaks');

-- ---------------------------------------------------------------------
-- sync_outbox_log (server-side audit of client-originated writes)
-- ---------------------------------------------------------------------
CREATE TABLE sync_audit_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_type         TEXT NOT NULL,                  -- 'visit' | 'attendance' | 'member'
    entity_id           UUID NOT NULL,
    action              TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    conflict_resolved   BOOLEAN NOT NULL DEFAULT FALSE,
    resolution_strategy TEXT,                            -- 'server_wins' | 'client_wins' | 'merged'
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE EXTENSION IF NOT EXISTS citext;

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_members_updated_at BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_visits_updated_at BEFORE UPDATE ON visits
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
