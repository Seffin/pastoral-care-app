import { Router } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/requireAuth';
import { recalculateAllPriorityScores } from '../services/priorityEngine';

export const attendanceRouter = Router();

const bulkAttendanceSchema = z.object({
  eventDate: z.string().date(),
  eventType: z
    .enum(['sunday_service', 'midweek', 'small_group', 'special_event'])
    .default('sunday_service'),
  records: z
    .array(
      z.object({
        memberId: z.string().uuid(),
        wasPresent: z.boolean(),
      })
    )
    .min(1)
    .max(5000),
});

/**
 * POST /api/attendance/bulk
 * Ingests a full roster's attendance for one event (e.g. Sunday
 * check-in export) in a single transaction, then triggers an
 * immediate priority recalculation so the dashboard reflects new
 * absence streaks without waiting for the nightly job.
 */
attendanceRouter.post('/bulk', async (req: AuthedRequest, res, next) => {
  try {
    const parsed = bulkAttendanceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
      return;
    }
    const { eventDate, eventType, records } = parsed.data;

    const pool = req.app.locals.pool;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const record of records) {
        await client.query(
          `INSERT INTO attendance (member_id, event_date, event_type, was_present, recorded_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (member_id, event_date, event_type)
           DO UPDATE SET was_present = EXCLUDED.was_present`,
          [record.memberId, eventDate, eventType, record.wasPresent, req.user!.id]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Fire-and-forget style recalculation kept synchronous here for
    // simplicity; for large congregations, move this to a queued job
    // (e.g. BullMQ) so the API response isn't blocked on the full scan.
    const { updated } = await recalculateAllPriorityScores(pool);

    res.status(201).json({ ingested: records.length, priorityScoresUpdated: updated });
  } catch (err) {
    next(err);
  }
});
