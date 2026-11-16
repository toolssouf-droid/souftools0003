/**
 * Persistent Turso (libSQL) Auth State Adapter for Baileys Multi-Device WhatsApp Engine
 * Stores cryptographically serializable Signal keys & credentials exclusively in Turso (`whatsapp_auth_sessions`).
 * Eliminates local filesystem writes for session keys.
 */

import {
  AuthenticationCreds,
  AuthenticationState,
  initAuthCreds,
  proto,
  BufferJSON,
} from "@whiskeysockets/baileys";
import { WhatsAppAuthRepository } from "@/lib/db";
import fs from "fs";
import path from "path";

const sessionMemoryCaches = new Map<string, Map<string, any>>();

function getSessionMemoryCache(sessionId: string): Map<string, any> {
  let cache = sessionMemoryCaches.get(sessionId);
  if (!cache) {
    cache = new Map<string, any>();
    sessionMemoryCaches.set(sessionId, cache);
  }
  return cache;
}

/**
 * Initializes and returns a persistent AuthenticationState backed exclusively by Turso.
 * Performs one-time read-only migration from legacy fallbackDir if Turso has no creds yet.
 */
export async function useTursoAuthState(
  sessionId: string = "default",
  fallbackDir?: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const memoryCache = getSessionMemoryCache(sessionId);

  let creds: AuthenticationCreds = initAuthCreds();
  const rawCreds = await WhatsAppAuthRepository.get(sessionId, "creds");

  if (rawCreds && rawCreds.trim()) {
    try {
      creds = JSON.parse(rawCreds, BufferJSON.reviver);
      memoryCache.set("creds", creds);
      console.log(`[WhatsApp Auth] Restored existing credentials from Turso for session '${sessionId}'.`);
    } catch (parseErr) {
      console.warn("[WhatsApp Auth] Failed to parse credentials from Turso, initializing fresh creds:", parseErr);
      creds = initAuthCreds();
      memoryCache.set("creds", creds);
    }
  } else {
    let migratedFromDisk = false;
    if (fallbackDir) {
      const diskCredsPath = path.join(fallbackDir, "creds.json");
      if (fs.existsSync(diskCredsPath)) {
        try {
          const fileContent = fs.readFileSync(diskCredsPath, "utf-8");
          creds = JSON.parse(fileContent, BufferJSON.reviver);
          memoryCache.set("creds", creds);
          await WhatsAppAuthRepository.set(sessionId, "creds", JSON.stringify(creds, BufferJSON.replacer));
          console.log(`[WhatsApp Auth] One-time imported legacy disk credentials into Turso for session '${sessionId}'.`);
          migratedFromDisk = true;
        } catch (migErr) {
          console.warn("[WhatsApp Auth] Legacy disk migration note:", migErr);
        }
      }
    }

    if (!migratedFromDisk) {
      creds = initAuthCreds();
      memoryCache.set("creds", creds);
    }
  }

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const data: { [key: string]: any } = {};
        const missingIds: string[] = [];

        for (const id of ids) {
          const keyId = `${type}-${id}`;
          if (memoryCache.has(keyId)) {
            data[id] = memoryCache.get(keyId);
          } else {
            missingIds.push(id);
          }
        }

        if (missingIds.length > 0) {
          const keyIdsToFetch = missingIds.map((id) => `${type}-${id}`);
          const dbRows = await WhatsAppAuthRepository.getMany(sessionId, keyIdsToFetch);

          for (const id of missingIds) {
            const keyId = `${type}-${id}`;
            const raw = dbRows[keyId];

            if (raw) {
              try {
                let value = JSON.parse(raw, BufferJSON.reviver);
                if (type === "app-state-sync-key" && value) {
                  value = proto.Message.AppStateSyncKeyData.fromObject(value);
                }
                memoryCache.set(keyId, value);
                data[id] = value;
              } catch {
                data[id] = null;
              }
            } else if (fallbackDir) {
              const diskPath = path.join(fallbackDir, `${keyId}.json`);
              if (fs.existsSync(diskPath)) {
                try {
                  const content = fs.readFileSync(diskPath, "utf-8");
                  let value = JSON.parse(content, BufferJSON.reviver);
                  if (type === "app-state-sync-key" && value) {
                    value = proto.Message.AppStateSyncKeyData.fromObject(value);
                  }
                  memoryCache.set(keyId, value);
                  data[id] = value;
                  WhatsAppAuthRepository.set(sessionId, keyId, content).catch(() => {});
                } catch {
                  data[id] = null;
                }
              } else {
                data[id] = null;
              }
            } else {
              data[id] = null;
            }
          }
        }

        return data;
      },

      set: async (data: any) => {
        const itemsToSet: Array<{ keyId: string; data: string }> = [];
        const itemsToRemove: string[] = [];

        for (const category in data) {
          for (const id in data[category]) {
            const value = data[category][id];
            const keyId = `${category}-${id}`;

            if (value) {
              memoryCache.set(keyId, value);
              const serialized = JSON.stringify(value, BufferJSON.replacer);
              itemsToSet.push({ keyId, data: serialized });
            } else {
              memoryCache.delete(keyId);
              itemsToRemove.push(keyId);
            }
          }
        }

        const promises: Promise<any>[] = [];
        if (itemsToSet.length > 0) {
          promises.push(WhatsAppAuthRepository.setMany(sessionId, itemsToSet));
        }
        if (itemsToRemove.length > 0) {
          promises.push(WhatsAppAuthRepository.removeMany(sessionId, itemsToRemove));
        }
        await Promise.all(promises);
      },
    },
  };

  const saveCreds = async () => {
    memoryCache.set("creds", creds);
    const serialized = JSON.stringify(creds, BufferJSON.replacer);
    await WhatsAppAuthRepository.set(sessionId, "creds", serialized);
  };

  return {
    state,
    saveCreds,
  };
}

/**
 * Completely purges a WhatsApp session from Turso (and removes any legacy local dir if present)
 */
export async function clearTursoAuthSession(
  sessionId: string = "default",
  fallbackDir?: string
): Promise<void> {
  const memoryCache = sessionMemoryCaches.get(sessionId);
  if (memoryCache) {
    memoryCache.clear();
  }

  await WhatsAppAuthRepository.clearSession(sessionId);

  if (fallbackDir && fs.existsSync(fallbackDir)) {
    try {
      fs.rmSync(fallbackDir, { recursive: true, force: true });
    } catch (err) {
      console.warn("[WhatsApp Auth] Legacy disk cleanup notice:", err);
    }
  }

  console.log(`[WhatsApp Auth] Completely cleared session '${sessionId}' from Turso.`);
}

// Backward-compatible named aliases
export const usePostgresAuthState = useTursoAuthState;
export const clearPostgresAuthSession = clearTursoAuthSession;
