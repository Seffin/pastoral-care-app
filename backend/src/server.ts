import { Pool } from 'pg';
import { createApp } from './app';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  max: Number(process.env.DATABASE_POOL_MAX) || 10,
});

const app = createApp(pool);
const port = Number(process.env.PORT) || 3000;

app.listen(port, '0.0.0.0', () => {
  console.info(`[server] listening on 0.0.0.0:${port}`);
});

process.on('SIGTERM', async () => {
  console.info('[server] SIGTERM received, closing pool');
  await pool.end();
  process.exit(0);
});
