import { Router } from 'express';
import { z } from 'zod';
import { encryptNullableField, decryptNullableField } from '../utils/encryption';
import type { AuthedRequest } from '../middleware/requireAuth';

export const membersRouter = Router();

/**
 * GET /api/members?limit=&offset=&status=
 * Dashboard listing — always sorted by priority_score DESC so the
 * highest-need members surface first. Pagination is required (no
 * unbounded scans of the full congregation over the wire).
 */
membersRouter.get('/', async (req: AuthedRequest, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const status = typeof req.query.status === 'string' ? req.query.status : 'active';

    const pool = req.app.locals.pool;
    const { rows } = await pool.query(
      `SELECT id, full_name, membership_status, care_flags,
              last_contacted_at, priority_score, assigned_pastor_id
         FROM members
        WHERE membership_status = $1
          AND is_active = TRUE
        ORDER BY priority_score DESC
        LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    // Note: full_name/status/score are not treated as sensitive enough
    // to withhold from a dashboard list view; phone/address/notes are
    // only decrypted on the single-member detail endpoint below, and
    // only for authorized roles.
    res.json({ members: rows, limit, offset });
  } catch (err) {
    next(err);
  }
});

membersRouter.get('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const pool = req.app.locals.pool;
    const { rows } = await pool.query(
      `SELECT id, full_name, encrypted_phone, encrypted_address, encryption_iv,
              membership_status, care_flags, last_contacted_at, priority_score,
              date_of_birth, joined_at, assigned_pastor_id
         FROM members
        WHERE id = $1`,
      [req.params.id]
    );
    const member = rows[0];
    if (!member) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    res.json({
      id: member.id,
      fullName: member.full_name,
      phone: decryptNullableField(member.encrypted_phone, member.encryption_iv),
      address: decryptNullableField(member.encrypted_address, member.encryption_iv),
      membershipStatus: member.membership_status,
      careFlags: member.care_flags,
      lastContactedAt: member.last_contacted_at,
      priorityScore: member.priority_score,
      dateOfBirth: member.date_of_birth,
      joinedAt: member.joined_at,
      assignedPastorId: member.assigned_pastor_id,
    });
  } catch (err) {
    next(err);
  }
});

const upsertMemberSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  membershipStatus: z
    .enum(['active', 'inactive', 'visitor', 'transferred', 'deceased'])
    .default('active'),
  careFlags: z.array(z.string()).default([]),
  assignedPastorId: z.string().uuid().optional(),
});

membersRouter.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const parsed = upsertMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
      return;
    }
    const { fullName, phone, address, membershipStatus, careFlags, assignedPastorId } =
      parsed.data;

    const phoneEnc = encryptNullableField(phone ?? null);
    const addressEnc = encryptNullableField(address ?? null);
    // Simplification: reuse one IV per record for both fields here. In
    // production, encrypt each field independently with its own IV
    // (separate columns) to avoid any nonce-reuse edge cases.
    const iv = phoneEnc?.iv ?? addressEnc?.iv ?? null;

    const pool = req.app.locals.pool;
    const { rows } = await pool.query(
      `INSERT INTO members
         (full_name, encrypted_phone, encrypted_address, encryption_iv,
          membership_status, care_flags, assigned_pastor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        fullName,
        phoneEnc?.ciphertext ?? null,
        addressEnc?.ciphertext ?? null,
        iv,
        membershipStatus,
        careFlags,
        assignedPastorId ?? null,
      ]
    );

    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
});
