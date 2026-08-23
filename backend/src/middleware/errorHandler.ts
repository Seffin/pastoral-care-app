import { Request, Response, NextFunction } from 'express';

/**
 * Central error handler. Deliberately avoids leaking stack traces or
 * raw DB error messages (which can include column/table names or
 * even fragments of query parameters) to the client.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error('[unhandled_error]', err);

  if (res.headersSent) return;

  res.status(500).json({ error: 'internal_server_error' });
}
