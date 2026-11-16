/**
 * SoufAI Web Push Notifications Manager
 * Handles VAPID key pairs, client subscription management, and server-side push dispatching.
 * Persists VAPID keys (encrypted) and subscriptions exclusively in Turso.
 */

import fs from "fs";
import path from "path";
import webpush from "web-push";
import { PushSubscriptionRepository, SettingsRepository } from "@/lib/db";
import { decryptKey, encryptKey } from "@/lib/encryption";

export interface PushSubscriptionData {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface StoredSubscriptionEntry {
  id: string;
  userId: string;
  subscription: PushSubscriptionData;
  userAgent?: string;
  createdAt: number;
  lastUsedAt?: number;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  id?: string;
  actions?: Array<{ action: string; title: string }>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const LEGACY_VAPID_KEYS_FILE = path.join(DATA_DIR, "web_push_vapid_keys.json");
const LEGACY_SUBSCRIPTIONS_FILE = path.join(DATA_DIR, "web_push_subscriptions.json");
const VAPID_SETTING_KEY = "web_push_vapid_keys";

function mapDbRowToEntry(row: any): StoredSubscriptionEntry {
  return {
    id: row.id,
    userId: row.userId || "default_user",
    subscription: {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth,
      },
    },
    userAgent: row.userAgent || undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt || Date.now()),
    lastUsedAt: row.lastUsedAt instanceof Date ? row.lastUsedAt.getTime() : row.lastUsedAt ? Number(row.lastUsedAt) : undefined,
  };
}

class WebPushManager {
  private publicKey: string = "";
  private privateKey: string = "";
  private subject: string = "mailto:souftoolsai@gmail.com";
  private subscriptions: Map<string, StoredSubscriptionEntry> = new Map();
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  public async ensureInitialized(forceReload = false): Promise<void> {
    if (this.initialized && !forceReload) return;
    if (this.initPromise && !forceReload) return this.initPromise;

    const task = (async () => {
      try {
        // 1. Resolve VAPID Keys: Env -> Turso Settings -> One-time legacy import -> Generate & save to Turso
        if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
          this.publicKey = process.env.VAPID_PUBLIC_KEY;
          this.privateKey = process.env.VAPID_PRIVATE_KEY;
        } else {
          const stored = await SettingsRepository.getSetting<{
            publicKey?: string;
            privateKey?: string;
            createdAt?: string;
          }>(VAPID_SETTING_KEY);

          if (stored?.publicKey && stored?.privateKey) {
            this.publicKey = stored.publicKey;
            this.privateKey = decryptKey(stored.privateKey);
          } else {
            let imported = false;
            if (fs.existsSync(LEGACY_VAPID_KEYS_FILE)) {
              try {
                const raw = fs.readFileSync(LEGACY_VAPID_KEYS_FILE, "utf-8");
                const parsed = JSON.parse(raw);
                if (parsed?.publicKey && parsed?.privateKey) {
                  this.publicKey = parsed.publicKey;
                  this.privateKey = parsed.privateKey;
                  await SettingsRepository.setSetting(
                    VAPID_SETTING_KEY,
                    {
                      publicKey: this.publicKey,
                      privateKey: encryptKey(this.privateKey),
                      createdAt: parsed.createdAt || new Date().toISOString(),
                    },
                    true
                  );
                  imported = true;
                }
              } catch (err) {
                console.warn("[WebPushManager] Legacy VAPID import note:", err);
              }
            }
            if (!imported) {
              await this.generateAndSaveKeys();
            }
          }
        }

        if (this.publicKey && this.privateKey) {
          webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
        }

        // 2. Load subscriptions from Turso (with one-time legacy JSON import if Turso is empty)
        let dbRows = await PushSubscriptionRepository.getAll();
        if ((!dbRows || dbRows.length === 0) && fs.existsSync(LEGACY_SUBSCRIPTIONS_FILE)) {
          try {
            const raw = fs.readFileSync(LEGACY_SUBSCRIPTIONS_FILE, "utf-8");
            const legacySubs: StoredSubscriptionEntry[] = JSON.parse(raw);
            if (Array.isArray(legacySubs) && legacySubs.length > 0) {
              for (const s of legacySubs) {
                if (s?.subscription?.endpoint && s.subscription?.keys?.p256dh && s.subscription?.keys?.auth) {
                  await PushSubscriptionRepository.saveSubscription({
                    id: s.id,
                    userId: s.userId || "default_user",
                    endpoint: s.subscription.endpoint,
                    keys: s.subscription.keys,
                    userAgent: s.userAgent,
                  });
                }
              }
              dbRows = await PushSubscriptionRepository.getAll();
            }
          } catch (err) {
            console.warn("[WebPushManager] Legacy subscriptions import note:", err);
          }
        }

        this.subscriptions.clear();
        for (const row of dbRows) {
          const entry = mapDbRowToEntry(row);
          this.subscriptions.set(entry.subscription.endpoint, entry);
        }

        this.initialized = true;
      } catch (err) {
        console.error("[WebPushManager] Initialization error:", err);
      } finally {
        this.initPromise = null;
      }
    })();

    this.initPromise = task;
    return task;
  }

  private async generateAndSaveKeys(): Promise<void> {
    try {
      const keys = webpush.generateVAPIDKeys();
      this.publicKey = keys.publicKey;
      this.privateKey = keys.privateKey;
      await SettingsRepository.setSetting(
        VAPID_SETTING_KEY,
        {
          publicKey: this.publicKey,
          privateKey: encryptKey(this.privateKey),
          createdAt: new Date().toISOString(),
        },
        true
      );
    } catch (err) {
      console.error("[WebPushManager] Failed to generate/save VAPID keys to Turso:", err);
    }
  }

  public getPublicKey(): string {
    return this.publicKey;
  }

  public async getPublicKeyAsync(): Promise<string> {
    await this.ensureInitialized();
    return this.publicKey;
  }

  public async saveSubscription(
    userId: string,
    subscription: PushSubscriptionData,
    userAgent?: string
  ): Promise<boolean> {
    await this.ensureInitialized();
    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return false;
    }

    const effectiveUserId = userId || "default_user";
    const saved = await PushSubscriptionRepository.saveSubscription({
      userId: effectiveUserId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent,
    });

    this.subscriptions.set(subscription.endpoint, {
      id: saved.id,
      userId: effectiveUserId,
      subscription,
      userAgent,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    });
    return true;
  }

  public async removeSubscription(endpoint: string, userId?: string): Promise<boolean> {
    await this.ensureInitialized();
    const removed = await PushSubscriptionRepository.removeByEndpoint(endpoint, userId);
    if (removed) {
      this.subscriptions.delete(endpoint);
    }
    return removed;
  }

  public async getSubscriptionsForUser(userId: string): Promise<StoredSubscriptionEntry[]> {
    await this.ensureInitialized();
    const targetUserId = userId || "default_user";
    const rows =
      targetUserId === "all"
        ? await PushSubscriptionRepository.getAll()
        : await PushSubscriptionRepository.listByUser(targetUserId);

    const mapped = rows.map(mapDbRowToEntry);
    for (const entry of mapped) {
      this.subscriptions.set(entry.subscription.endpoint, entry);
    }
    return mapped;
  }

  public async sendPushNotification(
    userId: string,
    payload: PushPayload
  ): Promise<{ sentCount: number; failedCount: number; errors: string[] }> {
    await this.ensureInitialized();
    const targetSubs = await this.getSubscriptionsForUser(userId);

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const succeededEndpoints: string[] = [];
    const expiredEndpoints: string[] = [];

    const stringifiedPayload = JSON.stringify({
      title: payload.title || "إشعار جديد من SoufAI",
      body: payload.body || "لديك تنبيه مهم في المنصة.",
      icon: payload.icon || "/icon.png",
      badge: payload.badge || "/icon.png",
      data: {
        url: payload.url || "/ar/chat",
        id: payload.id || `notif_${Date.now()}`,
        timestamp: Date.now(),
      },
      actions: payload.actions || [
        { action: "open", title: "عرض في المنصة" },
        { action: "dismiss", title: "تجاهل" },
      ],
    });

    for (const entry of targetSubs) {
      try {
        await webpush.sendNotification(entry.subscription as any, stringifiedPayload, {
          TTL: 60 * 60 * 24,
          urgency: "high",
        });
        sentCount++;
        entry.lastUsedAt = Date.now();
        succeededEndpoints.push(entry.subscription.endpoint);
      } catch (err: any) {
        failedCount++;
        const errMsg = err?.message || String(err);
        errors.push(errMsg);

        if (err?.statusCode === 404 || err?.statusCode === 410) {
          this.subscriptions.delete(entry.subscription.endpoint);
          expiredEndpoints.push(entry.subscription.endpoint);
        }
      }
    }

    if (succeededEndpoints.length > 0) {
      await PushSubscriptionRepository.touchLastUsed(succeededEndpoints);
    }
    for (const ep of expiredEndpoints) {
      await PushSubscriptionRepository.removeByEndpoint(ep);
    }

    return { sentCount, failedCount, errors };
  }

  public async broadcastPushNotification(payload: PushPayload) {
    return this.sendPushNotification("all", payload);
  }
}

const globalForWebPush = global as unknown as { webPushManager?: WebPushManager };
export const webPushManager = globalForWebPush.webPushManager || new WebPushManager();
if (process.env.NODE_ENV !== "production") globalForWebPush.webPushManager = webPushManager;
