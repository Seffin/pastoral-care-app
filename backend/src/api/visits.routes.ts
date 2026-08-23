import { Router } from 'express';
import { z } from 'zod';
import { encryptNullableField } from '../utils/encryption';
import type { AuthedRequest } from '../middleware/requireAuth';

export const visitsRouter = Router();

const logVisitSchema = z.object({
  memberId: z.string().uuid(),
  interactionType: z.enum(['in_person', 'phone_call', 'video_call', 'text_message', 'other']),
  notes: z.string().max(10_000).optional(),
  occurredAt: z.string().datetime().optional(),
  nextFollowUpDate: z.string().date().optional(),
  // Set by the mobile client at creation time; used as the idempotency
  // key so a retried sync from the offline outbox never double-inserts.
  clientGeneratedId: z.string().uuid(),
});

/**
 * POST /api/visits
 * Idempotent on `clientGeneratedId`: if the mobile outbox retries this
 * push (e.g. the response was lost after a network drop but the write
 * actually succeeded), the second attempt returns the existing row
 * instead of creating a duplicate visit.
 */
visitsRouter.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const parsed = logVisitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
      return;
    }
    const { memberId, interactionType, notes, occurredAt, nextFollowUpDate, clientGeneratedId } =
      parsed.data;

    const pool = req.app.locals.pool;

    const existing = await pool.query(`SELECT id FROM visits WHERE client_generated_id = $1`, [
      clientGeneratedId,
    ]);
    if (existing.rows[0]) {
      res.status(200).json({ id: existing.rows[0].id, deduplicated: true });
      return;
    }

    const notesEnc = encryptNullableField(notes ?? null);

    const { rows } = await pool.query(
      `INSERT INTO visits
         (member_id, visited_by, interaction_type, encrypted_notes, encryption_iv,
          occurred_at, next_follow_up_date, client_generated_id, sync_status)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), $7, $8, 'synced')
       RETURNING id`,
      [
        memberId,
        req.user!.id,
        interactionType,
        notesEnc?.ciphertext ?? null,
        notesEnc?.iv ?? null,
        occurredAt ?? null,
        nextFollowUpDate ?? null,
        clientGeneratedId,
      ]
    );

    // A logged visit resets the member's "days since contact" clock —
    // update the denormalized field the priority engine reads.
    await pool.query(
      `UPDATE members SET last_contacted_at = now() WHERE id = $1`,
      [memberId]
    );

    res.status(201).json({ id: rows[0].id, deduplicated: false });
  } catch (err) {
    next(err);
  }
});

visitsRouter.get('/member/:memberId', async (req: AuthedRequest, res, next) => {
  try {
    const pool = req.app.locals.pool;
    const { rows } = await pool.query(
      `SELECT id, interaction_type, occurred_at, next_follow_up_date, visited_by
         FROM visits
        WHERE member_id = $1
        ORDER BY occurred_at DESC
        LIMIT 100`,
      [req.params.memberId]
    );
    res.json({ visits: rows });
  } catch (err) {
    next(err);
  }
});
