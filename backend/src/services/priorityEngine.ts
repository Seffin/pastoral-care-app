/**
 * Priority Score Calculation Engine
 * ----------------------------------
 * S = (W1 * D_contact) + (W2 * A_absence) + W_urgency
 *
 *   D_contact  = days elapsed since last logged pastoral contact
 *   A_absence  = consecutive missed core-service events (streak, capped
 *                by `absence_lookback_events`)
 *   W_urgency  = flat bonus per active care flag (e.g. 'hospitalized',
 *                'bereaved'), summed across all flags on the member
 *
 * Weights are configurable at runtime via the `care_rules` table so
 * ministry leadership can tune the algorithm without a deploy.
 *
 * This module is pure/deterministic given its inputs, which keeps it
 * trivially unit-testable and safe to run identically on the server
 * (nightly cron) and, if ever needed, on-device for offline preview.
 */

import { Pool } from 'pg';

export interface CareRuleWeights {
  weightDaysSinceContact: number;
  weightConsecutiveAbsences: number;
  urgencyFlagBonus: number;
  absenceLookbackEvents: number;
}

export interface MemberScoringInput {
  memberId: string;
  lastContactedAt: Date | null;
  /** Most recent N attendance records for core services, newest first. */
  recentAttendance: { wasPresent: boolean }[];
  careFlags: string[];
  now?: Date;
}

export interface MemberScoreResult {
  memberId: string;
  daysSinceContact: number;
  consecutiveAbsences: number;
  urgencyBonus: number;
  priorityScore: number;
}

const DEFAULT_WEIGHTS: CareRuleWeights = {
  weightDaysSinceContact: 1.0,
  weightConsecutiveAbsences: 15.0,
  urgencyFlagBonus: 100.0,
  absenceLookbackEvents: 8,
};

/** Loads current weights from care_rules, falling back to safe defaults. */
export async function loadCareRuleWeights(pool: Pool): Promise<CareRuleWeights> {
  const { rows } = await pool.query<{ rule_key: string; rule_value: string }>(
    `SELECT rule_key, rule_value FROM care_rules`
  );
  const map = new Map(rows.map((r) => [r.rule_key, Number(r.rule_value)]));

  return {
    weightDaysSinceContact:
      map.get('weight_days_since_contact') ?? DEFAULT_WEIGHTS.weightDaysSinceContact,
    weightConsecutiveAbsences:
      map.get('weight_consecutive_absences') ?? DEFAULT_WEIGHTS.weightConsecutiveAbsences,
    urgencyFlagBonus: map.get('urgency_flag_bonus') ?? DEFAULT_WEIGHTS.urgencyFlagBonus,
    absenceLookbackEvents:
      map.get('absence_lookback_events') ?? DEFAULT_WEIGHTS.absenceLookbackEvents,
  };
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((a.getTime() - b.getTime()) / msPerDay));
}

/** Counts the leading run of "absent" records in newest-first order. */
function countConsecutiveAbsences(
  recentAttendance: { wasPresent: boolean }[],
  cap: number
): number {
  let streak = 0;
  for (const record of recentAttendance) {
    if (streak >= cap) break;
    if (record.wasPresent) break;
    streak += 1;
  }
  return streak;
}

/** Pure scoring function — no I/O, safe to unit test directly. */
export function scoreMember(
  input: MemberScoringInput,
  weights: CareRuleWeights = DEFAULT_WEIGHTS
): MemberScoreResult {
  const now = input.now ?? new Date();

  const daysSinceContact = input.lastContactedAt
    ? daysBetween(now, input.lastContactedAt)
    : 9999; // never contacted -> treat as maximally overdue, not zero

  const consecutiveAbsences = countConsecutiveAbsences(
    input.recentAttendance,
    weights.absenceLookbackEvents
  );

  const urgencyBonus = input.careFlags.length * weights.urgencyFlagBonus;

  const priorityScore =
    weights.weightDaysSinceContact * daysSinceContact +
    weights.weightConsecutiveAbsences * consecutiveAbsences +
    urgencyBonus;

  return {
    memberId: input.memberId,
    daysSinceContact,
    consecutiveAbsences,
    urgencyBonus,
    priorityScore: Math.round(priorityScore * 10000) / 10000,
  };
}

/**
 * Recomputes and persists priority_score for every active member.
 * Intended to run nightly (cron) and on-demand after bulk attendance
 * ingestion. Batches DB writes to avoid locking the table row-by-row.
 */
export async function recalculateAllPriorityScores(pool: Pool): Promise<{ updated: number }> {
  const weights = await loadCareRuleWeights(pool);

  const { rows: members } = await pool.query<{
    id: string;
    last_contacted_at: Date | null;
    care_flags: string[];
  }>(
    `SELECT id, last_contacted_at, care_flags
       FROM members
      WHERE is_active = TRUE`
  );

  const client = await pool.connect();
  let updated = 0;

  try {
    await client.query('BEGIN');

    for (const member of members) {
      const { rows: attendanceRows } = await client.query<{ was_present: boolean }>(
        `SELECT was_present
           FROM attendance
          WHERE member_id = $1
            AND event_type = 'sunday_service'
          ORDER BY event_date DESC
          LIMIT $2`,
        [member.id, weights.absenceLookbackEvents]
      );

      const result = scoreMember(
        {
          memberId: member.id,
          lastContactedAt: member.last_contacted_at,
          recentAttendance: attendanceRows.map((r) => ({ wasPresent: r.was_present })),
          careFlags: member.care_flags ?? [],
        },
        weights
      );

      await client.query(
        `UPDATE members
            SET priority_score = $1,
                priority_updated_at = now()
          WHERE id = $2`,
        [result.priorityScore, member.id]
      );
      updated += 1;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { updated };
}

/**
 * Entry point for a scheduled job runner (e.g. node-cron, BullMQ, or a
 * platform cron trigger). Wire this into your job scheduler of choice:
 *
 *   cron.schedule('0 2 * * *', () => runNightlyPriorityJob(pool));
 */
export async function runNightlyPriorityJob(pool: Pool): Promise<void> {
  const start = Date.now();
  try {
    const { updated } = await recalculateAllPriorityScores(pool);
    console.info(`[priorityEngine] recalculated ${updated} members in ${Date.now() - start}ms`);
  } catch (err) {
    console.error('[priorityEngine] nightly recalculation failed', err);
    throw err;
  }
}
