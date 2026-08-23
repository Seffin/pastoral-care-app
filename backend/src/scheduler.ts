import cron from 'node-cron';
import { Pool } from 'pg';
import { runNightlyPriorityJob } from './services/priorityEngine';

/**
 * Standalone scheduler process. Run this as a separate long-lived
 * process/container from the API server (`node dist/scheduler.js`),
 * or adapt the cron expression to your platform's scheduled-task
 * feature (e.g. AWS EventBridge -> Lambda, GCP Cloud Scheduler).
 */
export function startScheduler(pool: Pool): void {
  // 02:00 every day, server-local time.
  cron.schedule('0 2 * * *', async () => {
    try {
      await runNightlyPriorityJob(pool);
    } catch (err) {
      console.error('[scheduler] nightly priority job failed', err);
    }
  });

  console.info('[scheduler] nightly priority recalculation scheduled for 02:00');
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  startScheduler(pool);
}
