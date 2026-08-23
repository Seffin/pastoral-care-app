/**
 * Offline-First Sync Manager (Mobile Client)
 * --------------------------------------------
 * Responsibilities:
 *   1. Queue every local mutation (create/update/delete) into a durable
 *      `outbox` table instead of writing straight to the network.
 *   2. When connectivity returns, drain the outbox in order, sending
 *      each queued operation to the API.
 *   3. Detect and resolve conflicts using a last-write-wins strategy by
 *      default, with an explicit hook for field-level merges on visits
 *      (e.g. two staff logging different notes for the same visit
 *      while offline should not silently clobber one another).
 *   4. Never lose data: failed operations stay queued with backoff and
 *      surface a retry/error state to the UI rather than being dropped.
 *
 * This module is intentionally storage-agnostic behind a small
 * `LocalDatabase` interface so it can be unit tested with an in-memory
 * fake and wired to `react-native-sqlcipher-storage` (or equivalent)
 * in production.
 */

import { v4 as uuidv4 } from 'uuid';

export type EntityType = 'member' | 'attendance' | 'visit';
export type OperationType = 'create' | 'update' | 'delete';
export type OutboxStatus = 'queued' | 'in_flight' | 'failed' | 'done';

export interface OutboxItem {
  id: string;
  entityType: EntityType;
  entityId: string;
  operation: OperationType;
  payload: Record<string, unknown>;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  status: OutboxStatus;
}

/** Minimal surface the sync manager needs from the local SQLCipher DB. */
export interface LocalDatabase {
  enqueueOutboxItem(item: OutboxItem): Promise<void>;
  getQueuedOutboxItems(limit: number): Promise<OutboxItem[]>;
  markOutboxItem(id: string, patch: Partial<OutboxItem>): Promise<void>;
  deleteOutboxItem(id: string): Promise<void>;
  markEntitySynced(entityType: EntityType, entityId: string, serverUpdatedAt: string): Promise<void>;
  getLocalEntity(entityType: EntityType, entityId: string): Promise<Record<string, unknown> | null>;
  applyServerEntity(entityType: EntityType, entity: Record<string, unknown>): Promise<void>;
}

/** Minimal surface for the network layer, swappable for testing. */
export interface ApiClient {
  isOnline(): Promise<boolean>;
  pushOperation(item: OutboxItem): Promise<PushResult>;
  pullChangesSince(entityType: EntityType, cursor: string | null): Promise<{
    entities: Record<string, unknown>[];
    nextCursor: string | null;
  }>;
}

export type PushResult =
  | { outcome: 'accepted'; serverEntity: Record<string, unknown> }
  | { outcome: 'conflict'; serverEntity: Record<string, unknown> }
  | { outcome: 'rejected'; reason: string }
  | { outcome: 'network_error' };

const MAX_ATTEMPTS_BEFORE_BACKOFF_CAP = 6;
const BASE_BACKOFF_MS = 2000;

/** Exponential backoff with a ceiling, so a persistently failing item doesn't hammer the API. */
function computeBackoffMs(attemptCount: number): number {
  const capped = Math.min(attemptCount, MAX_ATTEMPTS_BEFORE_BACKOFF_CAP);
  return BASE_BACKOFF_MS * 2 ** capped;
}

export class SyncManager {
  private isSyncing = false;

  constructor(
    private readonly db: LocalDatabase,
    private readonly api: ApiClient,
    private readonly onConflict?: (
      entityType: EntityType,
      local: Record<string, unknown>,
      server: Record<string, unknown>
    ) => Record<string, unknown>
  ) {}

  /**
   * Call this from any local write path (visit logged, attendance
   * marked, member edited) INSTEAD of calling the API directly.
   * The write is applied optimistically to the local DB by the
   * caller; this only enqueues the durable outbox record.
   */
  async queueMutation(
    entityType: EntityType,
    entityId: string,
    operation: OperationType,
    payload: Record<string, unknown>
  ): Promise<void> {
    const item: OutboxItem = {
      id: uuidv4(),
      entityType,
      entityId,
      operation,
      payload,
      createdAt: new Date().toISOString(),
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
      status: 'queued',
    };
    await this.db.enqueueOutboxItem(item);
  }

  /**
   * Drains the outbox, in FIFO order, one item at a time (ordering
   * matters — e.g. a visit `create` must precede a later `update` to
   * the same visit). Safe to call repeatedly (e.g. on network-regained
   * events, app foreground, or a periodic timer); it's a no-op if
   * already running or offline.
   */
  async processOutbox(): Promise<{ synced: number; failed: number; conflicts: number }> {
    if (this.isSyncing) return { synced: 0, failed: 0, conflicts: 0 };
    if (!(await this.api.isOnline())) return { synced: 0, failed: 0, conflicts: 0 };

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    try {
      const items = await this.db.getQueuedOutboxItems(50);

      for (const item of items) {
        // Respect backoff: skip items that failed recently and aren't due yet.
        if (item.status === 'failed' && item.lastAttemptAt) {
          const dueAt = new Date(item.lastAttemptAt).getTime() + computeBackoffMs(item.attemptCount);
          if (Date.now() < dueAt) continue;
        }

        await this.db.markOutboxItem(item.id, { status: 'in_flight' });

        let result: PushResult;
        try {
          result = await this.api.pushOperation(item);
        } catch (err) {
          result = { outcome: 'network_error' };
        }

        switch (result.outcome) {
          case 'accepted': {
            await this.db.markEntitySynced(
              item.entityType,
              item.entityId,
              (result.serverEntity.updated_at as string) ?? new Date().toISOString()
            );
            await this.db.deleteOutboxItem(item.id);
            synced += 1;
            break;
          }

          case 'conflict': {
            await this.resolveConflict(item, result.serverEntity);
            await this.db.deleteOutboxItem(item.id);
            conflicts += 1;
            break;
          }

          case 'rejected': {
            // Not retryable (e.g. validation error) — surface to UI, don't keep retrying blindly.
            await this.db.markOutboxItem(item.id, {
              status: 'failed',
              attemptCount: item.attemptCount + 1,
              lastAttemptAt: new Date().toISOString(),
              lastError: result.reason,
            });
            failed += 1;
            break;
          }

          case 'network_error':
          default: {
            await this.db.markOutboxItem(item.id, {
              status: 'failed',
              attemptCount: item.attemptCount + 1,
              lastAttemptAt: new Date().toISOString(),
              lastError: 'network_error',
            });
            failed += 1;
            // Stop draining on the first network error — connectivity likely
            // dropped mid-sync, so further attempts will just fail too.
            return { synced, failed, conflicts };
          }
        }
      }
    } finally {
      this.isSyncing = false;
    }

    return { synced, failed, conflicts };
  }

  /**
   * Default conflict resolution: last-write-wins by server timestamp,
   * UNLESS a custom merge function was provided (useful for `visit`
   * notes, where silently discarding one pastor's note is unacceptable
   * and a field-level merge or "keep both" strategy is preferred).
   */
  private async resolveConflict(
    item: OutboxItem,
    serverEntity: Record<string, unknown>
  ): Promise<void> {
    const localEntity = await this.db.getLocalEntity(item.entityType, item.entityId);

    if (this.onConflict && localEntity) {
      const merged = this.onConflict(item.entityType, localEntity, serverEntity);
      await this.db.applyServerEntity(item.entityType, merged);
      return;
    }

    // Default: server wins. The device that comes back online second
    // does not clobber changes already accepted by the server.
    await this.db.applyServerEntity(item.entityType, serverEntity);
  }

  /** Pulls remote changes (from other devices/staff) down into the local DB. */
  async pullRemoteChanges(entityType: EntityType, cursor: string | null): Promise<string | null> {
    const { entities, nextCursor } = await this.api.pullChangesSince(entityType, cursor);
    for (const entity of entities) {
      await this.db.applyServerEntity(entityType, entity);
    }
    return nextCursor;
  }
}
