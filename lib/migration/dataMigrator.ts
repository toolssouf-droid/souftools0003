/**
 * SoufTools Storage & Data Migration Tool
 * Synchronizes schema migrations and legacy server data into the unified Turso database.
 */

import {
  ensureMigrationsRun,
  UserRepository,
  ConversationRepository,
  MemoryRepository,
  SettingsRepository,
  AuditRepository,
} from "@/lib/db";
import { loadServerAdminConfig } from "@/lib/adminConfigStore";
import { ensureToolsLoaded } from "@/lib/toolsConfig";
import { serverErrorManager } from "@/lib/errors/errorManager";
import { webPushManager } from "@/lib/notifications/webPushManager";
import { sandboxManager } from "@/lib/sandbox/sandboxManager";
import { telegramManager } from "@/lib/telegram/telegramManager";

export interface MigrationSummary {
  startedAt: string;
  completedAt?: string;
  status: "idle" | "running" | "completed" | "failed";
  migratedUsers: number;
  migratedSessions: number;
  migratedMemories: number;
  migratedSettings: number;
  errors: string[];
}

export class DataMigrator {
  private static status: MigrationSummary = {
    startedAt: "",
    status: "idle",
    migratedUsers: 0,
    migratedSessions: 0,
    migratedMemories: 0,
    migratedSettings: 0,
    errors: [],
  };

  public static getStatus(): MigrationSummary {
    return this.status;
  }

  /**
   * Executes schema check, one-time legacy JSON -> Turso sync if needed, and counts verification.
   */
  public static async executeMigration(adminUserId: string): Promise<MigrationSummary> {
    this.status = {
      startedAt: new Date().toISOString(),
      status: "running",
      migratedUsers: 0,
      migratedSessions: 0,
      migratedMemories: 0,
      migratedSettings: 0,
      errors: [],
    };

    try {
      await ensureMigrationsRun();

      // Hydrate and migrate any one-time legacy JSON data into Turso stores idempotently
      await Promise.all([
        loadServerAdminConfig().catch((e) => this.status.errors.push(String(e?.message || e))),
        ensureToolsLoaded().catch((e) => this.status.errors.push(String(e?.message || e))),
        serverErrorManager.ensureLoaded().catch((e) => this.status.errors.push(String(e?.message || e))),
        webPushManager.ensureInitialized().catch((e) => this.status.errors.push(String(e?.message || e))),
        sandboxManager.ensureLimitsLoaded().catch((e) => this.status.errors.push(String(e?.message || e))),
        telegramManager.ensureInitialized().catch((e) => this.status.errors.push(String(e?.message || e))),
      ]);

      const [users, conversations, settingKeys] = await Promise.all([
        UserRepository.listAllUsers(),
        ConversationRepository.listAllConversations(),
        SettingsRepository.listKeys(),
      ]);

      let memoriesTotal = 0;
      for (const u of users.slice(0, 50)) {
        const userMems = await MemoryRepository.listByUser(u.id).catch(() => []);
        memoriesTotal += userMems.length;
      }

      this.status.migratedUsers = users.length;
      this.status.migratedSessions = conversations.length;
      this.status.migratedMemories = memoriesTotal;
      this.status.migratedSettings = settingKeys.length;

      await AuditRepository.logAction({
        adminUserId,
        action: "TURSO_STORAGE_VERIFICATION",
        resourceType: "database",
        details: {
          usersCount: users.length,
          conversationsCount: conversations.length,
          memoriesSampleCount: memoriesTotal,
          settingsCount: settingKeys.length,
        },
      });

      this.status.status = "completed";
      this.status.completedAt = new Date().toISOString();
      return this.status;
    } catch (err: any) {
      this.status.status = "failed";
      this.status.errors.push(err?.message || String(err));
      return this.status;
    }
  }
}
