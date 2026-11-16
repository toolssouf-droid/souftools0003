/**
 * SoufTools Sync Engine & Real-Time Event Bus
 *
 * Provides:
 * 1. Server-Side Source of Truth synchronization with Turso (libSQL / Drizzle ORM).
 * 2. Real-time PubSub event dispatcher for Server-Sent Events (SSE).
 * 3. Cursor-based incremental synchronization (deltas).
 * 4. Optimistic concurrency control & conflict detection.
 */

import { getReadyDb, UserRepository } from "@/lib/db";
import { syncEvents, syncCursors } from "@/lib/db/schema";
import { eq, and, gt, asc } from "drizzle-orm";
import { toIsoDateString } from "@/lib/utils";

export interface SyncEventParams {
  userId: string;
  entityType: string;
  entityId: string;
  operation: "created" | "updated" | "deleted";
  version?: number;
  payload?: Record<string, any>;
  deviceId?: string | null;
}

export interface SyncDeltaItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: "created" | "updated" | "deleted";
  version: number;
  payload: Record<string, any>;
  deviceId: string | null;
  createdAt: string;
}

type SyncListener = (event: SyncDeltaItem) => void;
const activeListeners = new Map<string, Set<SyncListener>>();
const userAliases = new Map<string, Set<string>>();

export function registerUserAlias(canonicalUserId: string, alias: string) {
  if (!canonicalUserId || !alias || canonicalUserId === alias) return;

  if (!userAliases.has(canonicalUserId)) {
    userAliases.set(canonicalUserId, new Set());
  }
  userAliases.get(canonicalUserId)!.add(alias);

  if (!userAliases.has(alias)) {
    userAliases.set(alias, new Set());
  }
  userAliases.get(alias)!.add(canonicalUserId);
}

export function subscribeToSyncEvents(userId: string, listener: SyncListener, email?: string): () => void {
  if (!activeListeners.has(userId)) {
    activeListeners.set(userId, new Set());
  }
  const userSet = activeListeners.get(userId)!;
  userSet.add(listener);

  if (email && email !== userId) {
    registerUserAlias(userId, email);
  }

  return () => {
    userSet.delete(listener);
    if (userSet.size === 0) {
      activeListeners.delete(userId);
    }
  };
}

export function broadcastSyncEvent(userId: string, event: SyncDeltaItem): void {
  const targetIds = new Set<string>([userId]);

  const aliases = userAliases.get(userId);
  if (aliases) {
    aliases.forEach((a) => targetIds.add(a));
  }

  targetIds.forEach((targetId) => {
    const userSet = activeListeners.get(targetId);
    if (!userSet || userSet.size === 0) return;

    userSet.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn("[SyncEngine] Failed to dispatch real-time event to listener:", err);
      }
    });
  });
}

/**
 * Records a sync event in Turso, updates the server cursor atomically, and dispatches real-time SSE.
 */
export async function recordSyncEvent(params: SyncEventParams): Promise<{
  success: boolean;
  eventId?: string;
  event?: SyncDeltaItem;
}> {
  try {
    const database = await getReadyDb();
    await UserRepository.upsertUser({
      id: params.userId,
      email: `${params.userId}@souftools.app`,
    });

    const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const version = params.version || 1;
    const payload = params.payload || {};

    await database.transaction(async (tx) => {
      await tx.insert(syncEvents).values({
        id,
        userId: params.userId,
        deviceId: params.deviceId || null,
        entityType: params.entityType,
        entityId: params.entityId,
        operation: params.operation,
        version,
        payload,
        createdAt: now,
      });

      if (params.deviceId) {
        const existing = await tx
          .select()
          .from(syncCursors)
          .where(and(eq(syncCursors.userId, params.userId), eq(syncCursors.deviceId, params.deviceId)))
          .limit(1)
          .then((r) => r[0]);

        const nextRevision = (existing?.serverRevision || 0) + 1;

        if (existing) {
          await tx
            .update(syncCursors)
            .set({
              lastSyncTimestamp: now,
              lastEventId: id,
              serverRevision: nextRevision,
              updatedAt: now,
            })
            .where(eq(syncCursors.id, existing.id));
        } else {
          await tx
            .insert(syncCursors)
            .values({
              id: `cur_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              userId: params.userId,
              deviceId: params.deviceId,
              lastSyncTimestamp: now,
              lastEventId: id,
              serverRevision: 1,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [syncCursors.userId, syncCursors.deviceId],
              set: {
                lastSyncTimestamp: now,
                lastEventId: id,
                updatedAt: now,
              },
            });
        }
      }
    });

    const eventItem: SyncDeltaItem = {
      id,
      entityType: params.entityType,
      entityId: params.entityId,
      operation: params.operation,
      version,
      payload,
      deviceId: params.deviceId || null,
      createdAt: now.toISOString(),
    };

    broadcastSyncEvent(params.userId, eventItem);

    return { success: true, eventId: id, event: eventItem };
  } catch (error) {
    console.warn("[SyncEngine] Failed to record sync event:", error);
    return { success: false };
  }
}

/**
 * Retrieves incremental delta events for a user since a given cursor.
 */
export async function getSyncDelta(params: {
  userId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{
  events: SyncDeltaItem[];
  nextCursor: string;
  hasMore: boolean;
  serverRevision: number;
}> {
  const { userId, cursor, limit = 50 } = params;
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  let sinceDate: Date = new Date(0);
  if (cursor) {
    const parsedDate = new Date(cursor);
    if (!isNaN(parsedDate.getTime())) {
      sinceDate = parsedDate;
    }
  }

  try {
    const database = await getReadyDb();
    const rows = await database
      .select()
      .from(syncEvents)
      .where(and(eq(syncEvents.userId, userId), gt(syncEvents.createdAt, sinceDate)))
      .orderBy(asc(syncEvents.createdAt))
      .limit(safeLimit + 1);

    const hasMore = rows.length > safeLimit;
    const deltaRows = hasMore ? rows.slice(0, safeLimit) : rows;

    const events: SyncDeltaItem[] = deltaRows.map((r) => ({
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      operation: r.operation as any,
      version: r.version,
      payload: (r.payload as Record<string, any>) || {},
      deviceId: r.deviceId,
      createdAt: toIsoDateString(r.createdAt),
    }));

    const nextCursor =
      events.length > 0
        ? events[events.length - 1].createdAt
        : cursor || new Date().toISOString();

    return {
      events,
      nextCursor,
      hasMore,
      serverRevision: Date.now(),
    };
  } catch (error) {
    console.error("[SyncEngine] Error querying sync deltas:", error);
    return {
      events: [],
      nextCursor: cursor || new Date().toISOString(),
      hasMore: false,
      serverRevision: Date.now(),
    };
  }
}

/**
 * Updates or sets the sync cursor for a user device
 */
export async function updateDeviceCursor(
  userId: string,
  deviceId: string,
  timestamp: Date,
  lastEventId?: string
) {
  try {
    const database = await getReadyDb();
    await UserRepository.upsertUser({
      id: userId,
      email: `${userId}@souftools.app`,
    });

    const existing = await database
      .select()
      .from(syncCursors)
      .where(and(eq(syncCursors.userId, userId), eq(syncCursors.deviceId, deviceId)))
      .limit(1)
      .then((r) => r[0]);

    const nextRevision = (existing?.serverRevision || 0) + 1;

    if (existing) {
      await database
        .update(syncCursors)
        .set({
          lastSyncTimestamp: timestamp,
          lastEventId: lastEventId || existing.lastEventId,
          serverRevision: nextRevision,
          updatedAt: new Date(),
        })
        .where(eq(syncCursors.id, existing.id));
    } else {
      await database
        .insert(syncCursors)
        .values({
          id: `cur_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId,
          deviceId,
          lastSyncTimestamp: timestamp,
          lastEventId: lastEventId || null,
          serverRevision: 1,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [syncCursors.userId, syncCursors.deviceId],
          set: {
            lastSyncTimestamp: timestamp,
            lastEventId: lastEventId || null,
            updatedAt: new Date(),
          },
        });
    }
  } catch (err) {
    console.warn("[SyncEngine] Failed to update device cursor:", err);
  }
}

export function validateOptimisticVersion(
  serverVersion: number,
  clientVersion: number
): { conflict: boolean; message?: string } {
  if (clientVersion < serverVersion) {
    return {
      conflict: true,
      message: `Conflict detected: client version (${clientVersion}) is outdated compared to server version (${serverVersion}).`,
    };
  }
  return { conflict: false };
}
