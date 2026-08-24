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
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  try {
    const db = await SQLite.openDatabase({
      name: 'pastoral_care.db',
      location: 'default',
    });

    await initializeDatabase(db);
    dbInstance = db;
    return dbInstance;
  } catch (error) {
    console.error('Error opening local SQLite database:', error);
    throw error;
  }
}

async function initializeDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  // 1. Create tables with the complete base schema
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS members (
        id                  TEXT PRIMARY KEY,
        full_name           TEXT NOT NULL,
        member_type         TEXT NOT NULL DEFAULT 'individual',
        family_count        INTEGER NOT NULL DEFAULT 0,
        family_members      TEXT NOT NULL DEFAULT '[]',
        phone               TEXT NOT NULL DEFAULT '',
        location            TEXT NOT NULL DEFAULT '',
        membership_status   TEXT NOT NULL DEFAULT 'active',
        care_flags          TEXT NOT NULL DEFAULT '[]',
        last_contacted_at   TEXT,
        priority_score      REAL NOT NULL DEFAULT 0,
        is_active           INTEGER NOT NULL DEFAULT 1
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS visits (
        id                  TEXT PRIMARY KEY,
        member_id           TEXT NOT NULL,
        interaction_type    TEXT NOT NULL,
        visit_date          TEXT NOT NULL,
        time_of_day         TEXT,
        notes               TEXT,
        contribution        TEXT,
        next_follow_up      TEXT
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS settings (
        key                 TEXT PRIMARY KEY,
        value               TEXT NOT NULL
    );
  `);

  // 2. Safe migrations for existing databases created before full schema
  try {
    const [infoResult] = await db.executeSql(`PRAGMA table_info(members);`);
    const existingCols = new Set<string>();
    for (let i = 0; i < infoResult.rows.length; i++) {
      existingCols.add(infoResult.rows.item(i).name);
    }

    const colsToAdd: { col: string; type: string }[] = [
      { col: 'member_type', type: "TEXT DEFAULT 'individual'" },
      { col: 'family_count', type: 'INTEGER DEFAULT 0' },
      { col: 'family_members', type: "TEXT DEFAULT '[]'" },
      { col: 'phone', type: "TEXT DEFAULT ''" },
      { col: 'location', type: "TEXT DEFAULT ''" },
    ];

    for (const { col, type } of colsToAdd) {
      if (!existingCols.has(col)) {
        try {
          await db.executeSql(`ALTER TABLE members ADD COLUMN ${col} ${type};`);
        } catch (e) {
          console.warn(`Could not add column ${col} to members:`, e);
        }
      }
    }
  } catch (err) {
    console.warn('Migration inspection warning:', err);
  }

  // 3. Seed default settings
  await db.executeSql('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);', ['visit_gap_months', '3']);
  await db.executeSql('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);', ['theme_mode', 'light']);
}

// ── Helpers ────────────────────────────────────────────
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function rowToMember(row: any): MemberRecord {
  const lastContact = row.last_contacted_at;
  let daysSince = 9999;
  if (lastContact && typeof lastContact === 'string') {
    const parts = lastContact.trim().split(/[-T :]/);
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const contactDate = new Date(y, m, d);
        const today = new Date();
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffMs = todayDate.getTime() - contactDate.getTime();
        daysSince = Math.max(0, Math.floor(diffMs / 86400000));
      }
    }
  }

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
  const newId = generateId();
  await db.executeSql(
    `INSERT INTO members (id, full_name, member_type, family_count, family_members, phone, location, care_flags, priority_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [newId, name, memberType, familyCount, JSON.stringify(familyMembers), phone, location, JSON.stringify(careFlags)]
  );
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
  const sets: string[] = [];
  const vals: any[] = [];

  if (fields.status !== undefined) { sets.push('membership_status = ?'); vals.push(fields.status); }
  if (fields.phone !== undefined) { sets.push('phone = ?'); vals.push(fields.phone); }
  if (fields.location !== undefined) { sets.push('location = ?'); vals.push(fields.location); }
  if (fields.careFlags !== undefined) { sets.push('care_flags = ?'); vals.push(JSON.stringify(fields.careFlags)); }
  if (fields.familyMembers !== undefined) { sets.push('family_members = ?'); vals.push(JSON.stringify(fields.familyMembers)); }

  if (sets.length === 0) return;

  vals.push(id);
  await db.executeSql(
    `UPDATE members SET ${sets.join(', ')} WHERE id = ?`,
    vals
  );
}

export async function deleteMember(id: string): Promise<void> {
  const db = await getDb();
  await db.executeSql(`UPDATE members SET is_active = 0 WHERE id = ?`, [id]);
}

export async function getMemberById(id: string): Promise<MemberRecord | null> {
  const db = await getDb();
  const [results] = await db.executeSql('SELECT * FROM members WHERE id = ?', [id]);
  if (results.rows.length > 0) {
    return rowToMember(results.rows.item(0));
  }
  return null;
}

// ── Member Listing (sorted by days since contact — longest first) ──
export async function getAllMembers(filter?: 'all' | 'pending' | 'visited' | 'overdue'): Promise<MemberRecord[]> {
  const db = await getDb();
  const gapMonthsStr = await getSetting('visit_gap_months', '3');
  const gapMonths = parseInt(gapMonthsStr, 10) || 3;
  const gapDays = gapMonths * 30;

  const [results] = await db.executeSql(
    `SELECT * FROM members WHERE is_active = 1`
  );

  let members: MemberRecord[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    members.push(rowToMember(results.rows.item(i)));
  }

  // Sort by daysSinceContact DESC (longest gap first; never contacted = 9999 first)
  members.sort((a, b) => {
    if (b.daysSinceContact !== a.daysSinceContact) {
      return b.daysSinceContact - a.daysSinceContact;
    }
    return a.fullName.localeCompare(b.fullName);
  });

  // Apply filters
  if (filter === 'pending' || filter === 'overdue') {
    members = members.filter(m => m.membershipStatus === 'active' && m.daysSinceContact >= gapDays);
  } else if (filter === 'visited') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    members = members.filter(m => {
      if (!m.lastContactedAt) return false;
      const parts = m.lastContactedAt.trim().split(/[-T :]/);
      if (parts.length < 3) return false;
      const y = parseInt(parts[0], 10);
      const mIdx = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, mIdx, d).getTime() >= monthStart;
    });
  }

  return members;
}

// ── Visit CRUD ─────────────────────────────────────────
export async function addVisit(
  memberId: string,
  interactionType: string,
  visitDate: string,
  timeOfDay: string,
  notes: string,
  nextFollowUp: string | null
): Promise<void> {
  const db = await getDb();
  const newId = generateId();

  await db.executeSql(
    `INSERT INTO visits (id, member_id, interaction_type, visit_date, time_of_day, notes, contribution, next_follow_up) VALUES (?, ?, ?, ?, ?, ?, '', ?)`,
    [newId, memberId, interactionType, visitDate, timeOfDay, notes, nextFollowUp]
  );
  await db.executeSql(
    `UPDATE members SET last_contacted_at = ? WHERE id = ?`,
    [visitDate, memberId]
  );
}

export async function getVisitsForMember(memberId: string): Promise<VisitRecord[]> {
  const db = await getDb();
  const [results] = await db.executeSql(
    `SELECT * FROM visits WHERE member_id = ? ORDER BY visit_date DESC`,
    [memberId]
  );
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
  return visits;
}

// ── Settings ───────────────────────────────────────────
export async function getSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const db = await getDb();
    const [results] = await db.executeSql('SELECT value FROM settings WHERE key = ?', [key]);
    if (results.rows.length > 0) {
      return results.rows.item(0).value;
    }
    return defaultValue;
  } catch (err) {
    console.warn(`Failed to get setting ${key}:`, err);
    return defaultValue;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.executeSql(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}
