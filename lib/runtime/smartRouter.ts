/**
 * SoufAI Runtime Manager - Smart Router
 * Routes project execution requests dynamically between Cloud Sandbox (E2B) and Local WebContainer.
 */

import {
  SandboxCreateOptions,
  SandboxExecutionResponse,
  SandboxProviderId,
} from "./types";
import { getRuntimeProviders, getRuntimeSettings, addRuntimeLog } from "./runtimeDatabaseServices";
import { getSandboxProvider } from "./providers";
import { KeyRotationManager } from "./keyRotationManager";

export class SmartRuntimeRouter {
  /**
   * Intelligently selects the best provider and provisions the sandbox with automatic key rotation
   */
  public static async createSandbox(options: SandboxCreateOptions): Promise<SandboxExecutionResponse> {
    const [providers, settings] = await Promise.all([
      getRuntimeProviders(),
      getRuntimeSettings(),
    ]);

    const activeProviders = providers
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    if (activeProviders.length === 0) {
      // Emergency in-memory WebContainer
      const fallbackProvider = getSandboxProvider("webcontainer");
      return fallbackProvider.createSandbox(options);
    }

    let lastError = "";

    for (const provConfig of activeProviders) {
      try {
        const providerInstance = getSandboxProvider(provConfig.provider);

        // Fetch rotated active key for cloud providers (like E2B)
        let resolvedKey = "";
        let activeKeyItem = null;

        if (provConfig.isCloudSandbox) {
          activeKeyItem = await KeyRotationManager.getNextActiveKey(provConfig.provider);
          if (activeKeyItem) {
            resolvedKey = KeyRotationManager.getDecryptedKey(activeKeyItem);
          }
        }

        // Attempt sandbox creation
        const res = await providerInstance.createSandbox(options, resolvedKey);

        if (res.success) {
          if (activeKeyItem && activeKeyItem.id !== "env_fallback_e2b" && res.latencyMs) {
            await KeyRotationManager.reportSuccess(activeKeyItem.id, res.latencyMs);
          }
          return res;
        }

        lastError = res.error || res.message || "Failed";

        // Report failure to KeyRotationManager if key was used
        if (activeKeyItem && activeKeyItem.id !== "env_fallback_e2b") {
          await KeyRotationManager.reportFailure(activeKeyItem.id, lastError);
        }

        await addRuntimeLog({
          event: "failover",
          provider: provConfig.provider,
          success: false,
          timestamp: Date.now(),
          sessionId: options.projectId,
          userId: options.userId,
          details: `فشل التشغيل على ${provConfig.name} (${lastError}). التحويل للمزود التالي في سلم الأولويات...`,
        });
      } catch (err: any) {
        lastError = err?.message || "Execution exception";
      }
    }

    // Final fallback to browser local execution
    const localFallback = getSandboxProvider("webcontainer");
    const fallbackRes = await localFallback.createSandbox(options);

    return {
      ...fallbackRes,
      message: `تم التشغيل عبر WebContainer المحلي كبديل احتياطي ذكي (السبب: ${lastError})`,
    };
  }

  public static async stopSandbox(
    sessionId: string,
    providerId: SandboxProviderId = "native_sandbox"
  ): Promise<{ success: boolean; message: string }> {
    const providerInstance = getSandboxProvider(providerId);
    return providerInstance.stopSandbox(sessionId);
  }

  public static async restartSandbox(
    sessionId: string,
    providerId: SandboxProviderId = "native_sandbox",
    files: Record<string, string>
  ): Promise<SandboxExecutionResponse> {
    const providerInstance = getSandboxProvider(providerId);
    return providerInstance.restartSandbox(sessionId, files);
  }

  public static async checkStatus(
    sessionId: string,
    providerId: SandboxProviderId = "native_sandbox"
  ): Promise<{ active: boolean; port?: number; previewUrl?: string }> {
    const providerInstance = getSandboxProvider(providerId);
    return providerInstance.checkStatus(sessionId);
  }
}
