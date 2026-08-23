import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthedRequest extends Request {
  user?: { id: string; role: string };
}

/**
 * Verifies a short-lived JWT access token issued by /api/auth/login.
 * Tokens are signed with a server-side secret (JWT_SIGNING_SECRET);
 * never trust a `role` or `id` claim from an unverified token.
 */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const secret = process.env.JWT_SIGNING_SECRET;
    if (!secret) throw new Error('JWT_SIGNING_SECRET not configured');

    const payload = jwt.verify(token, secret) as { sub: string; role: string };
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'invalid_or_expired_token' });
  }
}

/** Restricts a route to specific roles, e.g. requireRole('admin'). */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  };
}
