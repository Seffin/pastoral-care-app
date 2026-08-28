// ─────────────────────────────────────────────────────────────────
//  localDb.ts  –  Offline SQLite persistence layer
//
//  Design principles:
//  • All tables include created_at, updated_at, synced (cloud-ready)
//  • Every mutation returns a typed result or throws a typed error
//  • Schema migrations use safe ALTER TABLE (idempotent)
//  • Queries are parameterised – no string concatenation
//  • Import/Export produces a single structured JSON document
// ─────────────────────────────────────────────────────────────────

import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

// ── Internal state ────────────────────────────────────────────────
let _db: SQLite.SQLiteDatabase | null = null;

// ── ID generator (no crypto dependency) ──────────────────────────
function genId(): string {
  return (
    Math.random().toString(36).substring(2, 11) +
    '-' +
    Date.now().toString(36)
  );
}

// ── Types ─────────────────────────────────────────────────────────
export interface FamilyPerson {
  name: string;
  age: string;
  isHospitalized: boolean;
}

export interface MemberRecord {
  id: string;
  fullName: string;
  memberType: 'individual' | 'family';
  familyCount: number;
  familyMembers: FamilyPerson[];
  phone: string;
  location: string;
  membershipStatus: string;
  careFlags: string[];
  lastContactedAt: string | null;
  daysSinceContact: number;
  createdAt: string;
  synced: number;
}

export interface VisitRecord {
  id: string;
  memberId: string;
  interactionType: string;
  visitDate: string;
  timeOfDay: string;
  notes: string;
  contribution: string;
  nextFollowUp: string | null;
  createdAt: string;
  synced: number;
}

export interface CottageMeetingRecord {
  id: string;
  meetingDate: string;
  timeOfDay: string;
  hostMemberId: string | null;
  hostNameManual: string;
  attendeesCount: number;
  notes: string;
  contribution: string;
  createdAt: string;
  synced: number;
}

export interface FastingPrayerRecord {
  id: string;
  prayerDate: string;
  timeOfDay: string;
  attendeesCount: number;
  prayerRequests: string;
  notes: string;
  contribution: string;
  createdAt: string;
  synced: number;
}

export interface BibleClassRecord {
  id: string;
  classDate: string;
  timeOfDay: string;
  topic: string;
  attendeesCount: number;
  notes: string;
  contribution: string;
  createdAt: string;
  synced: number;
}

export interface BackupDocument {
  version: number;
  exportedAt: string;
  members: any[];
  visits: any[];
  cottageMeetings: any[];
  fastingPrayers: any[];
  bibleClasses: any[];
  settings: any[];
}

// ── Database access ───────────────────────────────────────────────
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabase({ name: 'pastoral_care.db', location: 'default' });
  await _initSchema(_db);
  return _db;
}

// ── Helpers ───────────────────────────────────────────────────────
function _parse<T>(val: string | null, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

function _now(): string {
  return new Date().toISOString();
}

function _daysSince(isoDate: string | null): number {
  if (!isoDate) return 9999;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

function _rowToMember(row: any): MemberRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    memberType: row.member_type || 'individual',
    familyCount: row.family_count || 0,
    familyMembers: _parse<FamilyPerson[]>(row.family_members, []),
    phone: row.phone || '',
    location: row.location || '',
    membershipStatus: row.membership_status || 'active',
    careFlags: _parse<string[]>(row.care_flags, []),
    lastContactedAt: row.last_contacted_at,
    daysSinceContact: _daysSince(row.last_contacted_at),
    createdAt: row.created_at || _now(),
    synced: row.synced ?? 0,
  };
}

function _rowToVisit(row: any): VisitRecord {
  return {
    id: row.id,
    memberId: row.member_id,
    interactionType: row.interaction_type,
    visitDate: row.visit_date,
    timeOfDay: row.time_of_day || '',
    notes: row.notes || '',
    contribution: row.contribution || '',
    nextFollowUp: row.next_follow_up,
    createdAt: row.created_at || _now(),
    synced: row.synced ?? 0,
  };
}

// ── Schema initialisation ─────────────────────────────────────────
// IMPORTANT: react-native-sqlite-storage transaction callbacks must
// be synchronous. Do NOT use async/await inside the callback.
// Each migration runs in its own transaction so a failure (column
// already exists) does not rollback the table-creation transaction.
async function _initSchema(db: SQLite.SQLiteDatabase): Promise<void> {

  // ── Transaction 1: Create all tables ────────────────────────────
  await new Promise<void>((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS members (
            id                TEXT PRIMARY KEY,
            full_name         TEXT NOT NULL,
            member_type       TEXT NOT NULL DEFAULT 'individual',
            family_count      INTEGER NOT NULL DEFAULT 0,
            family_members    TEXT NOT NULL DEFAULT '[]',
            phone             TEXT NOT NULL DEFAULT '',
            location          TEXT NOT NULL DEFAULT '',
            membership_status TEXT NOT NULL DEFAULT 'active',
            care_flags        TEXT NOT NULL DEFAULT '[]',
            last_contacted_at TEXT,
            priority_score    REAL NOT NULL DEFAULT 0,
            is_active         INTEGER NOT NULL DEFAULT 1,
            created_at        TEXT NOT NULL DEFAULT '',
            updated_at        TEXT NOT NULL DEFAULT '',
            synced            INTEGER NOT NULL DEFAULT 0
          )
        `);
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS visits (
            id               TEXT PRIMARY KEY,
            member_id        TEXT NOT NULL,
            interaction_type TEXT NOT NULL,
            visit_date       TEXT NOT NULL,
            time_of_day      TEXT NOT NULL DEFAULT '',
            notes            TEXT NOT NULL DEFAULT '',
            contribution     TEXT NOT NULL DEFAULT '',
            next_follow_up   TEXT,
            created_at       TEXT NOT NULL DEFAULT '',
            updated_at       TEXT NOT NULL DEFAULT '',
            synced           INTEGER NOT NULL DEFAULT 0
          )
        `);
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS cottage_meetings (
            id               TEXT PRIMARY KEY,
            meeting_date     TEXT NOT NULL,
            time_of_day      TEXT NOT NULL DEFAULT '',
            host_member_id   TEXT,
            host_name_manual TEXT NOT NULL DEFAULT '',
            attendees_count  INTEGER NOT NULL DEFAULT 0,
            notes            TEXT NOT NULL DEFAULT '',
            contribution     TEXT NOT NULL DEFAULT '',
            created_at       TEXT NOT NULL DEFAULT '',
            updated_at       TEXT NOT NULL DEFAULT '',
            synced           INTEGER NOT NULL DEFAULT 0
          )
        `);
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS fasting_prayers (
            id               TEXT PRIMARY KEY,
            prayer_date      TEXT NOT NULL,
            time_of_day      TEXT NOT NULL DEFAULT '',
            attendees_count  INTEGER NOT NULL DEFAULT 0,
            prayer_requests  TEXT NOT NULL DEFAULT '',
            notes            TEXT NOT NULL DEFAULT '',
            contribution     TEXT NOT NULL DEFAULT '',
            created_at       TEXT NOT NULL DEFAULT '',
            updated_at       TEXT NOT NULL DEFAULT '',
            synced           INTEGER NOT NULL DEFAULT 0
          )
        `);
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS bible_classes (
            id              TEXT PRIMARY KEY,
            class_date      TEXT NOT NULL,
            time_of_day     TEXT NOT NULL DEFAULT '',
            topic           TEXT NOT NULL DEFAULT '',
            attendees_count INTEGER NOT NULL DEFAULT 0,
            notes           TEXT NOT NULL DEFAULT '',
            contribution    TEXT NOT NULL DEFAULT '',
            created_at      TEXT NOT NULL DEFAULT '',
            updated_at      TEXT NOT NULL DEFAULT '',
            synced          INTEGER NOT NULL DEFAULT 0
          )
        `);
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )
        `);
        tx.executeSql(`INSERT OR IGNORE INTO settings (key, value) VALUES ('visit_gap_months', '3')`);
        tx.executeSql(`INSERT OR IGNORE INTO settings (key, value) VALUES ('theme_mode', 'light')`);
      },
      err => { console.error('[DB] schema init failed:', err); reject(err); },
      () => resolve(),
    );
  });

  // ── Transaction 2+: Migrations (each in its own transaction) ────
  // Running separately so a duplicate-column error (column exists)
  // only rolls back that single ALTER and not the whole schema.
  const migrations: Array<[string, string, string, string]> = [
    ['members', 'member_type',   'TEXT',    "'individual'"],
    ['members', 'family_count',  'INTEGER', '0'],
    ['members', 'family_members','TEXT',    "'[]'"],
    ['members', 'phone',         'TEXT',    "''"],
    ['members', 'location',      'TEXT',    "''"],
    ['members', 'created_at',    'TEXT',    "''"],
    ['members', 'updated_at',    'TEXT',    "''"],
    ['members', 'synced',        'INTEGER', '0'],
    ['visits',  'created_at',    'TEXT',    "''"],
    ['visits',  'updated_at',    'TEXT',    "''"],
    ['visits',  'synced',        'INTEGER', '0'],
  ];

  for (const [table, col, type, def] of migrations) {
    // Each migration is fire-and-forget; ignore errors (column may exist)
    await new Promise<void>(resolve => {
      db.transaction(
        tx => { tx.executeSql(`ALTER TABLE ${table} ADD COLUMN ${col} ${type} NOT NULL DEFAULT ${def}`); },
        () => resolve(),   // error = column exists, that's fine
        () => resolve(),   // success
      );
    });
  }
}


// ─────────────────────────────────────────────────────────────────
//  SETTINGS
// ─────────────────────────────────────────────────────────────────

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  const db = await getDb();
  return new Promise((resolve) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT value FROM settings WHERE key = ?',
        [key],
        (_, r) => resolve(r.rows.length > 0 ? r.rows.item(0).value : defaultValue),
        () => { resolve(defaultValue); return false; },
      );
    });
  });
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, value],
        () => resolve(),
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

// ─────────────────────────────────────────────────────────────────
//  MEMBERS
// ─────────────────────────────────────────────────────────────────

export async function addMemberFull(
  name: string,
  memberType: 'individual' | 'family',
  familyCount: number,
  familyMembers: FamilyPerson[],
  phone: string,
  location: string,
  careFlags: string[],
): Promise<void> {
  const db = await getDb();
  const now = _now();
  const id = genId();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO members
           (id, full_name, member_type, family_count, family_members,
            phone, location, care_flags, priority_score, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [id, name, memberType, familyCount, JSON.stringify(familyMembers),
         phone, location, JSON.stringify(careFlags), now, now],
        () => resolve(),
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

export async function getMemberById(id: string): Promise<MemberRecord | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM members WHERE id = ?',
        [id],
        (_, r) => resolve(r.rows.length > 0 ? _rowToMember(r.rows.item(0)) : null),
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

export async function getAllMembers(
  filter: 'all' | 'pending' | 'visited' | 'overdue' = 'all',
): Promise<MemberRecord[]> {
  const db = await getDb();
  const gapMonths = parseInt(await getSetting('visit_gap_months', '3'), 10) || 3;
  const gapDays = gapMonths * 30;

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM members
          WHERE is_active = 1
          ORDER BY
            CASE WHEN last_contacted_at IS NULL THEN 0 ELSE 1 END ASC,
            last_contacted_at ASC,
            full_name ASC`,
        // ↑ SQLite does not support NULLS FIRST — simulate it with CASE
        [],
        (_, r) => {
          let list: MemberRecord[] = [];
          for (let i = 0; i < r.rows.length; i++) list.push(_rowToMember(r.rows.item(i)));

          if (filter === 'pending' || filter === 'overdue') {
            list = list.filter(m => m.membershipStatus === 'active' && m.daysSinceContact >= gapDays);
          } else if (filter === 'visited') {
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
            list = list.filter(m => m.lastContactedAt && new Date(m.lastContactedAt).getTime() >= monthStart);
          }

          resolve(list);
        },
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

export async function updateMember(
  id: string,
  fields: {
    status?: string;
    phone?: string;
    location?: string;
    careFlags?: string[];
    familyMembers?: FamilyPerson[];
  },
): Promise<void> {
  const db = await getDb();
  const sets: string[] = ['updated_at = ?'];
  const vals: any[] = [_now()];

  if (fields.status !== undefined)       { sets.push('membership_status = ?'); vals.push(fields.status); }
  if (fields.phone !== undefined)        { sets.push('phone = ?');             vals.push(fields.phone); }
  if (fields.location !== undefined)     { sets.push('location = ?');          vals.push(fields.location); }
  if (fields.careFlags !== undefined)    { sets.push('care_flags = ?');        vals.push(JSON.stringify(fields.careFlags)); }
  if (fields.familyMembers !== undefined){ sets.push('family_members = ?');    vals.push(JSON.stringify(fields.familyMembers)); }

  vals.push(id);

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `UPDATE members SET ${sets.join(', ')}, synced = 0 WHERE id = ?`,
        vals,
        () => resolve(),
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

export async function deleteMember(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `UPDATE members SET is_active = 0, updated_at = ?, synced = 0 WHERE id = ?`,
        [_now(), id],
        () => resolve(),
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

// ─────────────────────────────────────────────────────────────────
//  VISITS
// ─────────────────────────────────────────────────────────────────

export async function addVisit(
  memberId: string,
  interactionType: string,
  visitDate: string,
  timeOfDay: string,
  notes: string,
  contribution: string,
  nextFollowUp: string | null,
): Promise<void> {
  const db = await getDb();
  const now = _now();
  const id = genId();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO visits
           (id, member_id, interaction_type, visit_date, time_of_day,
            notes, contribution, next_follow_up, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, memberId, interactionType, visitDate, timeOfDay, notes, contribution, nextFollowUp, now, now],
      );
      // Update last_contacted_at using the actual visit date
      tx.executeSql(
        `UPDATE members SET last_contacted_at = ?, updated_at = ?, synced = 0 WHERE id = ?`,
        [visitDate, now, memberId],
        () => resolve(),
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

export async function getVisitsForMember(memberId: string): Promise<VisitRecord[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM visits WHERE member_id = ? ORDER BY visit_date DESC`,
        [memberId],
        (_, r) => {
          const list: VisitRecord[] = [];
          for (let i = 0; i < r.rows.length; i++) list.push(_rowToVisit(r.rows.item(i)));
          resolve(list);
        },
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

// ─────────────────────────────────────────────────────────────────
//  COTTAGE MEETINGS
// ─────────────────────────────────────────────────────────────────

export async function addCottageMeeting(data: {
  meetingDate: string;
  timeOfDay: string;
  hostMemberId: string | null;
  hostNameManual: string;
  attendeesCount: number;
  notes: string;
  contribution: string;
}): Promise<void> {
  const db = await getDb();
  const now = _now();
  const id = genId();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO cottage_meetings
           (id, meeting_date, time_of_day, host_member_id, host_name_manual,
            attendees_count, notes, contribution, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.meetingDate, data.timeOfDay, data.hostMemberId, data.hostNameManual,
         data.attendeesCount, data.notes, data.contribution, now, now],
        () => resolve(),
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

export async function getCottageMeetings(): Promise<CottageMeetingRecord[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM cottage_meetings ORDER BY meeting_date DESC',
        [],
        (_, r) => {
          const list: CottageMeetingRecord[] = [];
          for (let i = 0; i < r.rows.length; i++) {
            const row = r.rows.item(i);
            list.push({
              id: row.id,
              meetingDate: row.meeting_date,
              timeOfDay: row.time_of_day,
              hostMemberId: row.host_member_id,
              hostNameManual: row.host_name_manual,
              attendeesCount: row.attendees_count,
              notes: row.notes,
              contribution: row.contribution,
              createdAt: row.created_at,
              synced: row.synced,
            });
          }
          resolve(list);
        },
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

export async function deleteCottageMeeting(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM cottage_meetings WHERE id = ?',
        [id],
        () => resolve(),
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

// ─────────────────────────────────────────────────────────────────
//  FASTING PRAYERS
// ─────────────────────────────────────────────────────────────────

export async function addFastingPrayer(data: {
  prayerDate: string;
  timeOfDay: string;
  attendeesCount: number;
  prayerRequests: string;
  notes: string;
  contribution: string;
}): Promise<void> {
  const db = await getDb();
  const now = _now();
  const id = genId();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO fasting_prayers
           (id, prayer_date, time_of_day, attendees_count,
            prayer_requests, notes, contribution, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.prayerDate, data.timeOfDay, data.attendeesCount,
         data.prayerRequests, data.notes, data.contribution, now, now],
        () => resolve(),
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

export async function getFastingPrayers(): Promise<FastingPrayerRecord[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM fasting_prayers ORDER BY prayer_date DESC',
        [],
        (_, r) => {
          const list: FastingPrayerRecord[] = [];
          for (let i = 0; i < r.rows.length; i++) {
            const row = r.rows.item(i);
            list.push({
              id: row.id,
              prayerDate: row.prayer_date,
              timeOfDay: row.time_of_day,
              attendeesCount: row.attendees_count,
              prayerRequests: row.prayer_requests,
              notes: row.notes,
              contribution: row.contribution,
              createdAt: row.created_at,
              synced: row.synced,
            });
          }
          resolve(list);
        },
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

export async function deleteFastingPrayer(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM fasting_prayers WHERE id = ?',
        [id],
        () => resolve(),
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

// ─────────────────────────────────────────────────────────────────
//  BIBLE CLASSES
// ─────────────────────────────────────────────────────────────────

export async function addBibleClass(data: {
  classDate: string;
  timeOfDay: string;
  topic: string;
  attendeesCount: number;
  notes: string;
  contribution: string;
}): Promise<void> {
  const db = await getDb();
  const now = _now();
  const id = genId();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO bible_classes
           (id, class_date, time_of_day, topic,
            attendees_count, notes, contribution, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.classDate, data.timeOfDay, data.topic,
         data.attendeesCount, data.notes, data.contribution, now, now],
        () => resolve(),
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

export async function getBibleClasses(): Promise<BibleClassRecord[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM bible_classes ORDER BY class_date DESC',
        [],
        (_, r) => {
          const list: BibleClassRecord[] = [];
          for (let i = 0; i < r.rows.length; i++) {
            const row = r.rows.item(i);
            list.push({
              id: row.id,
              classDate: row.class_date,
              timeOfDay: row.time_of_day,
              topic: row.topic,
              attendeesCount: row.attendees_count,
              notes: row.notes,
              contribution: row.contribution,
              createdAt: row.created_at,
              synced: row.synced,
            });
          }
          resolve(list);
        },
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

export async function deleteBibleClass(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM bible_classes WHERE id = ?',
        [id],
        () => resolve(),
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

// ─────────────────────────────────────────────────────────────────
//  STATISTICS (used by Operations Dashboard)
// ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalMembers: number;
  visitedThisMonth: number;
  pendingVisit: number;
  cottageMeetingsThisMonth: number;
  fastingPrayersThisMonth: number;
  bibleClassesThisMonth: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDb();
  const gapMonths = parseInt(await getSetting('visit_gap_months', '3'), 10) || 3;
  const gapDays = gapMonths * 30;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const queryOne = (sql: string, params: any[] = []): Promise<number> =>
    new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(sql, params,
          (_, r) => resolve(r.rows.item(0).cnt ?? 0),
          (_, err) => { reject(err); return false; },
        );
      });
    });

  const [
    totalMembers,
    visitedThisMonth,
    cottageMeetingsThisMonth,
    fastingPrayersThisMonth,
    bibleClassesThisMonth,
  ] = await Promise.all([
    queryOne(`SELECT COUNT(*) as cnt FROM members WHERE is_active = 1`),
    queryOne(`SELECT COUNT(*) as cnt FROM members WHERE is_active = 1 AND last_contacted_at >= ?`, [monthStart]),
    queryOne(`SELECT COUNT(*) as cnt FROM cottage_meetings WHERE meeting_date >= ?`, [monthStart]),
    queryOne(`SELECT COUNT(*) as cnt FROM fasting_prayers WHERE prayer_date >= ?`, [monthStart]),
    queryOne(`SELECT COUNT(*) as cnt FROM bible_classes WHERE class_date >= ?`, [monthStart]),
  ]);

  const allActive = await getAllMembers('all');
  const pendingVisit = allActive.filter(
    m => m.membershipStatus === 'active' && m.daysSinceContact >= gapDays,
  ).length;

  return {
    totalMembers,
    visitedThisMonth,
    pendingVisit,
    cottageMeetingsThisMonth,
    fastingPrayersThisMonth,
    bibleClassesThisMonth,
  };
}

// ─────────────────────────────────────────────────────────────────
//  EXPORT / IMPORT  (Backup & Restore)
// ─────────────────────────────────────────────────────────────────

async function _fetchAll(db: SQLite.SQLiteDatabase, sql: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(sql, [],
        (_, r) => {
          const rows: any[] = [];
          for (let i = 0; i < r.rows.length; i++) rows.push(r.rows.item(i));
          resolve(rows);
        },
        (_, err) => { reject(err); return false; },
      );
    });
  });
}

export async function exportBackupJson(): Promise<string> {
  const db = await getDb();
  const [members, visits, cottageMeetings, fastingPrayers, bibleClasses, settings] = await Promise.all([
    _fetchAll(db, 'SELECT * FROM members WHERE is_active = 1'),
    _fetchAll(db, 'SELECT * FROM visits'),
    _fetchAll(db, 'SELECT * FROM cottage_meetings'),
    _fetchAll(db, 'SELECT * FROM fasting_prayers'),
    _fetchAll(db, 'SELECT * FROM bible_classes'),
    _fetchAll(db, 'SELECT * FROM settings'),
  ]);

  const doc: BackupDocument = {
    version: 2,
    exportedAt: _now(),
    members,
    visits,
    cottageMeetings,
    fastingPrayers,
    bibleClasses,
    settings,
  };

  return JSON.stringify(doc, null, 2);
}

export async function importBackupJson(jsonString: string): Promise<void> {
  let doc: BackupDocument;
  try {
    doc = JSON.parse(jsonString) as BackupDocument;
  } catch {
    throw new Error('Invalid JSON – the backup file could not be read.');
  }

  if (!doc.version || !doc.members) {
    throw new Error('Unrecognised backup format. Please use a backup exported from this app.');
  }

  const db = await getDb();

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      try {
        // Clear existing data
        tx.executeSql('DELETE FROM visits');
        tx.executeSql('DELETE FROM members');
        tx.executeSql('DELETE FROM cottage_meetings');
        tx.executeSql('DELETE FROM fasting_prayers');
        tx.executeSql('DELETE FROM bible_classes');

        // Restore members
        for (const m of (doc.members || [])) {
          tx.executeSql(
            `INSERT OR REPLACE INTO members
               (id, full_name, member_type, family_count, family_members,
                phone, location, membership_status, care_flags, last_contacted_at,
                priority_score, is_active, created_at, updated_at, synced)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [m.id, m.full_name, m.member_type || 'individual', m.family_count || 0,
             m.family_members || '[]', m.phone || '', m.location || '',
             m.membership_status || 'active', m.care_flags || '[]',
             m.last_contacted_at, m.priority_score || 0, m.is_active ?? 1,
             m.created_at || '', m.updated_at || '', 0],
          );
        }

        // Restore visits
        for (const v of (doc.visits || [])) {
          tx.executeSql(
            `INSERT OR REPLACE INTO visits
               (id, member_id, interaction_type, visit_date, time_of_day,
                notes, contribution, next_follow_up, created_at, updated_at, synced)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [v.id, v.member_id, v.interaction_type, v.visit_date, v.time_of_day || '',
             v.notes || '', v.contribution || '', v.next_follow_up,
             v.created_at || '', v.updated_at || '', 0],
          );
        }

        // Restore cottage meetings
        for (const c of (doc.cottageMeetings || [])) {
          tx.executeSql(
            `INSERT OR REPLACE INTO cottage_meetings
               (id, meeting_date, time_of_day, host_member_id, host_name_manual,
                attendees_count, notes, contribution, created_at, updated_at, synced)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [c.id, c.meeting_date, c.time_of_day || '', c.host_member_id,
             c.host_name_manual || '', c.attendees_count || 0,
             c.notes || '', c.contribution || '', c.created_at || '', c.updated_at || '', 0],
          );
        }

        // Restore fasting prayers
        for (const f of (doc.fastingPrayers || [])) {
          tx.executeSql(
            `INSERT OR REPLACE INTO fasting_prayers
               (id, prayer_date, time_of_day, attendees_count,
                prayer_requests, notes, contribution, created_at, updated_at, synced)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [f.id, f.prayer_date, f.time_of_day || '', f.attendees_count || 0,
             f.prayer_requests || '', f.notes || '', f.contribution || '',
             f.created_at || '', f.updated_at || '', 0],
          );
        }

        // Restore bible classes
        for (const b of (doc.bibleClasses || [])) {
          tx.executeSql(
            `INSERT OR REPLACE INTO bible_classes
               (id, class_date, time_of_day, topic, attendees_count,
                notes, contribution, created_at, updated_at, synced)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [b.id, b.class_date, b.time_of_day || '', b.topic || '', b.attendees_count || 0,
             b.notes || '', b.contribution || '', b.created_at || '', b.updated_at || '', 0],
          );
        }

        // Restore settings (keep theme preference)
        for (const s of (doc.settings || [])) {
          if (s.key !== 'theme_mode') {
            tx.executeSql('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
          }
        }
      } catch (e) {
        reject(e);
        return;
      }
    },
    (err) => reject(err),
    () => resolve(),
    );
  });
}
