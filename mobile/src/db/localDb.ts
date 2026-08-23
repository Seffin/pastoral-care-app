import SQLite from 'react-native-sqlite-storage';

// Enable Promise API
SQLite.enablePromise(true);

let dbInstance: SQLite.SQLiteDatabase | null = null;

// ── Types ──────────────────────────────────────────────
export interface MemberRecord {
  id: string;
  fullName: string;
  memberType: 'individual' | 'family';
  familyCount: number;
  familyMembers: { name: string; age: string; isHospitalized: boolean }[];
  phone: string;
  location: string;
  membershipStatus: string;
  careFlags: string[];
  lastContactedAt: string | null;
  daysSinceContact: number;
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
}

// ── Database Initialization ────────────────────────────
export async function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = await SQLite.openDatabase({
    name: 'pastoral_care.db',
    location: 'default',
  });

  await initializeDatabase(dbInstance);
  return dbInstance;
}

async function initializeDatabase(db: SQLite.SQLiteDatabase) {
  await db.transaction(async (tx) => {
    // Create members table
    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS members (
          id                  TEXT PRIMARY KEY,
          full_name           TEXT NOT NULL,
          membership_status   TEXT NOT NULL DEFAULT 'active',
          care_flags          TEXT NOT NULL DEFAULT '[]',
          last_contacted_at   TEXT,
          priority_score      REAL NOT NULL DEFAULT 0,
          is_active           INTEGER NOT NULL DEFAULT 1
      );
    `);

    // Create visits table
    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS visits (
          id TEXT PRIMARY KEY,
          member_id TEXT NOT NULL,
          interaction_type TEXT NOT NULL,
          visit_date TEXT NOT NULL,
          time_of_day TEXT,
          notes TEXT,
          contribution TEXT,
          next_follow_up TEXT
      );
    `);

    // Create settings table
    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
      );
    `);

    // ── Schema migrations (safe ALTER TABLEs) ──
    const addColumnSafe = (table: string, col: string, type: string, def?: string) => {
      const defClause = def !== undefined ? ` DEFAULT ${def}` : '';
      tx.executeSql(
        `ALTER TABLE ${table} ADD COLUMN ${col} ${type}${defClause}`,
        [],
        () => {},
        () => { return false; } // Column already exists — ignore error
      );
    };

    addColumnSafe('members', 'member_type', "TEXT", "'individual'");
    addColumnSafe('members', 'family_count', 'INTEGER', '0');
    addColumnSafe('members', 'family_members', 'TEXT', "'[]'");
    addColumnSafe('members', 'phone', 'TEXT', "''");
    addColumnSafe('members', 'location', 'TEXT', "''");

    // Seed default settings
    tx.executeSql('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['visit_gap_months', '3']);
    tx.executeSql('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['theme_mode', 'light']);
  });
}

// ── Helpers ────────────────────────────────────────────
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function rowToMember(row: any): MemberRecord {
  const lastContact = row.last_contacted_at;
  const daysSince = lastContact
    ? Math.floor((Date.now() - new Date(lastContact).getTime()) / 86400000)
    : 9999;
  return {
    id: row.id,
    fullName: row.full_name,
    memberType: row.member_type || 'individual',
    familyCount: row.family_count || 0,
    familyMembers: safeParseJson(row.family_members, []),
    phone: row.phone || '',
    location: row.location || '',
    membershipStatus: row.membership_status || 'active',
    careFlags: safeParseJson(row.care_flags, []),
    lastContactedAt: lastContact,
    daysSinceContact: daysSince,
  };
}

function safeParseJson(val: string | null, fallback: any): any {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// ── Member CRUD ────────────────────────────────────────
export async function addMemberFull(
  name: string,
  memberType: 'individual' | 'family',
  familyCount: number,
  familyMembers: { name: string; age: string; isHospitalized: boolean }[],
  phone: string,
  location: string,
  careFlags: string[],
): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    try {
      const newId = generateId();
      db.transaction((tx) => {
        tx.executeSql(
          `INSERT INTO members (id, full_name, member_type, family_count, family_members, phone, location, care_flags, priority_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [newId, name, memberType, familyCount, JSON.stringify(familyMembers), phone, location, JSON.stringify(careFlags)],
          () => resolve(),
          (_, error) => { reject(error); return false; }
        );
      });
    } catch (e) {
      reject(e);
    }
  });
}

export async function updateMember(
  id: string,
  fields: {
    status?: string;
    phone?: string;
    location?: string;
    careFlags?: string[];
    familyMembers?: { name: string; age: string; isHospitalized: boolean }[];
  }
): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const sets: string[] = [];
    const vals: any[] = [];

    if (fields.status !== undefined) { sets.push('membership_status = ?'); vals.push(fields.status); }
    if (fields.phone !== undefined) { sets.push('phone = ?'); vals.push(fields.phone); }
    if (fields.location !== undefined) { sets.push('location = ?'); vals.push(fields.location); }
    if (fields.careFlags !== undefined) { sets.push('care_flags = ?'); vals.push(JSON.stringify(fields.careFlags)); }
    if (fields.familyMembers !== undefined) { sets.push('family_members = ?'); vals.push(JSON.stringify(fields.familyMembers)); }

    if (sets.length === 0) { resolve(); return; }

    vals.push(id);
    db.transaction((tx) => {
      tx.executeSql(
        `UPDATE members SET ${sets.join(', ')} WHERE id = ?`,
        vals,
        () => resolve(),
        (_, error) => { reject(error); return false; }
      );
    });
  });
}

export async function deleteMember(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `UPDATE members SET is_active = 0 WHERE id = ?`,
        [id],
        () => resolve(),
        (_, error) => { reject(error); return false; }
      );
    });
  });
}

export async function getMemberById(id: string): Promise<MemberRecord | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql('SELECT * FROM members WHERE id = ?', [id], (_, results) => {
        if (results.rows.length > 0) {
          resolve(rowToMember(results.rows.item(0)));
        } else {
          resolve(null);
        }
      }, (_, error) => { reject(error); return false; });
    });
  });
}

// ── Member Listing (sorted by days since contact — longest first) ──
export async function getAllMembers(filter?: 'all' | 'pending' | 'visited' | 'overdue'): Promise<MemberRecord[]> {
  const db = await getDb();
  const gapMonths = parseInt(await getSetting('visit_gap_months', '3'), 10) || 3;
  const gapDays = gapMonths * 30;

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM members WHERE is_active = 1 ORDER BY last_contacted_at ASC, full_name ASC`,
        [],
        (_, results) => {
          let members: MemberRecord[] = [];
          for (let i = 0; i < results.rows.length; i++) {
            members.push(rowToMember(results.rows.item(i)));
          }

          // Apply filters
          if (filter === 'pending') {
            members = members.filter(m => m.membershipStatus === 'active' && m.daysSinceContact >= gapDays);
          } else if (filter === 'visited') {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            members = members.filter(m => {
              if (!m.lastContactedAt) return false;
              return new Date(m.lastContactedAt).getTime() >= monthStart;
            });
          } else if (filter === 'overdue') {
            members = members.filter(m => m.membershipStatus === 'active' && m.daysSinceContact >= gapDays);
          }

          resolve(members);
        },
        (_, error) => { reject(error); return false; }
      );
    });
  });
}

// ── Visit CRUD ─────────────────────────────────────────
export async function addVisit(
  memberId: string,
  interactionType: string,
  visitDate: string,
  timeOfDay: string,
  notes: string,
  contribution: string,
  nextFollowUp: string | null
): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    try {
      const newId = generateId();
      db.transaction((tx) => {
        tx.executeSql(
          `INSERT INTO visits (id, member_id, interaction_type, visit_date, time_of_day, notes, contribution, next_follow_up) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId, memberId, interactionType, visitDate, timeOfDay, notes, contribution, nextFollowUp]
        );
        // FIX: use visitDate instead of current time so past visits register correctly
        tx.executeSql(
          `UPDATE members SET last_contacted_at = ? WHERE id = ?`,
          [visitDate, memberId],
          () => resolve(),
          (_, error) => { reject(error); return false; }
        );
      });
    } catch (e) {
      reject(e);
    }
  });
}

export async function getVisitsForMember(memberId: string): Promise<VisitRecord[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM visits WHERE member_id = ? ORDER BY visit_date DESC`,
        [memberId],
        (_, results) => {
          const visits: VisitRecord[] = [];
          for (let i = 0; i < results.rows.length; i++) {
            const r = results.rows.item(i);
            visits.push({
              id: r.id,
              memberId: r.member_id,
              interactionType: r.interaction_type,
              visitDate: r.visit_date,
              timeOfDay: r.time_of_day || '',
              notes: r.notes || '',
              contribution: r.contribution || '',
              nextFollowUp: r.next_follow_up,
            });
          }
          resolve(visits);
        },
        (_, error) => { reject(error); return false; }
      );
    });
  });
}

// ── Settings ───────────────────────────────────────────
export async function getSetting(key: string, defaultValue: string): Promise<string> {
  const db = await getDb();
  return new Promise((resolve) => {
    db.transaction((tx) => {
      tx.executeSql('SELECT value FROM settings WHERE key = ?', [key], (_, results) => {
        if (results.rows.length > 0) {
          resolve(results.rows.item(0).value);
        } else {
          resolve(defaultValue);
        }
      }, () => { resolve(defaultValue); return false; });
    });
  });
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, value],
        () => resolve(),
        (_, error) => { reject(error); return false; }
      );
    });
  });
}
