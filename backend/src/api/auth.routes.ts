import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

export const authRouter = Router();

// Stricter limiter on auth endpoints to blunt credential-stuffing / brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

authRouter.post('/login', authLimiter, async (req, res, _next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
      return;
    }
    const { email, password } = parsed.data;

    const pool = req.app.locals.pool;
    const { rows } = await pool.query(
      `SELECT id, password_hash, role, is_active FROM users WHERE email = $1`,
      [email]
    );
    const user = rows[0];

    // Constant-shape response whether the user exists or not, to avoid
    // leaking which emails are registered.
    if (!user || !user.is_active) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    const validPassword = await argon2.verify(user.password_hash, password);
    if (!validPassword) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    const secret = process.env.JWT_SIGNING_SECRET;
    if (!secret) throw new Error('JWT_SIGNING_SECRET not configured');

    const accessToken = jwt.sign({ sub: user.id, role: user.role }, secret, {
      expiresIn: '15m',
    });
    const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, secret, {
      expiresIn: '30d',
    });

    res.json({ accessToken, refreshToken, expiresIn: 900 });
  } catch (err) {
    _next(err);
  }
});

authRouter.post('/refresh', authLimiter, async (req, res, _next) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) {
      res.status(400).json({ error: 'missing_refresh_token' });
      return;
    }

    const secret = process.env.JWT_SIGNING_SECRET;
    if (!secret) throw new Error('JWT_SIGNING_SECRET not configured');

    const payload = jwt.verify(refreshToken, secret) as { sub: string; type: string };
    if (payload.type !== 'refresh') {
      res.status(401).json({ error: 'invalid_token_type' });
      return;
    }

    const pool = req.app.locals.pool;
    const { rows } = await pool.query(`SELECT role, is_active FROM users WHERE id = $1`, [
      payload.sub,
    ]);
    if (!rows[0]?.is_active) {
      res.status(401).json({ error: 'account_inactive' });
      return;
    }

    const accessToken = jwt.sign({ sub: payload.sub, role: rows[0].role }, secret, {
      expiresIn: '15m',
    });
    res.json({ accessToken, expiresIn: 900 });
  } catch {
    res.status(401).json({ error: 'invalid_or_expired_refresh_token' });
  }
});
