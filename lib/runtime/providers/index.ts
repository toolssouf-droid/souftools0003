/**
 * SoufTools Runtime Manager - Providers Registry & Fallback Providers
 */

import { ISandboxProvider } from "./e2bProvider";
import { NativeSandboxProvider } from "./nativeSandboxProvider";
import {
  SandboxCreateOptions,
  SandboxExecutionResponse,
  SandboxProviderId,
  KeyTestResult,
  SandboxResources,
} from "../types";

export class WebContainerProvider implements ISandboxProvider {
  public id: SandboxProviderId = "webcontainer";
  public name = "Browser WebContainer";

  public async createSandbox(options: SandboxCreateOptions, _apiKey?: string): Promise<SandboxExecutionResponse> {
    const startTime = Date.now();
    const sessionId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    return {
      success: true,
      sessionId,
      previewUrl: "", // Handled locally in iframe srcDoc
      status: "active",
      provider: "webcontainer",
      latencyMs: Date.now() - startTime,
      message: "تم تجهيز بيئة التشغيل المعزولة داخل المتصفح بنجاح",
      resources: {
        cpu: "Local CPU",
        memory: "Shared Client RAM",
        disk: "Virtual FS",
        activeTimeSeconds: 0,
      },
    };
  }

  public async startProject(
    sessionId: string,
    _files: Record<string, string>,
    _framework: string,
    _apiKey?: string
  ): Promise<SandboxExecutionResponse> {
    return {
      success: true,
      sessionId,
      status: "active",
      provider: "webcontainer",
      message: "تم تحديث بيئة المعاينة المحلية بنجاح",
    };
  }

  public async stopSandbox(sessionId: string, _apiKey?: string): Promise<{ success: boolean; message: string }> {
    return { success: true, message: "تم إيقاف جلسة المعاينة المحلية بنجاح" };
  }

  public async restartSandbox(
    sessionId: string,
    _files: Record<string, string>,
    _apiKey?: string
  ): Promise<SandboxExecutionResponse> {
    return {
      success: true,
      sessionId,
      status: "active",
      provider: "webcontainer",
      message: "تمت إعادة تشغيل الجلسة المحلية",
    };
  }

  public async checkStatus(_sessionId?: string, _apiKey?: string): Promise<{ active: boolean; resources?: SandboxResources }> {
    return {
      active: true,
      resources: {
        cpu: "Client Device",
        memory: "Client Memory",
        disk: "Client Storage",
      },
    };
  }

  public async testKey(): Promise<KeyTestResult> {
    return {
      keyId: "webcontainer_builtin",
      valid: true,
      latencyMs: 1,
      message: "بيئة WebContainer مدمجة مجانية لا تتطلب مفتاح API",
      testedAt: Date.now(),
    };
  }
}

export const PROVIDERS_MAP: Record<SandboxProviderId, ISandboxProvider> = {
  native_sandbox: new NativeSandboxProvider(),
  webcontainer: new WebContainerProvider(),
  docker: new NativeSandboxProvider(),
  e2b: new NativeSandboxProvider(), // Replaced completely with NativeSandboxProvider
};

export function getSandboxProvider(providerId: SandboxProviderId = "native_sandbox"): ISandboxProvider {
  return PROVIDERS_MAP[providerId] || PROVIDERS_MAP.native_sandbox;
}

export * from "./e2bProvider";
export * from "./nativeSandboxProvider";

