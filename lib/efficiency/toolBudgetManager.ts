// lib/efficiency/toolBudgetManager.ts
/**
 * Tool Budget Manager & Max Steps Controller
 * Tracks tool usage against configured quota limits and enforces loop ceilings
 */

import { getEfficiencyConfig } from "./efficiencyStore";
import { MaxStepsMode, ToolBudgets } from "./types";

export class TaskToolBudgetTracker {
  private toolUsage: Record<string, number> = {};
  private currentStep: number = 0;
  private maxSteps: number = 7;
  private budgets: ToolBudgets;

  constructor(customMode?: MaxStepsMode) {
    const config = getEfficiencyConfig();
    const mode = customMode || config.maxStepsMode;

    const stepLimits: Record<MaxStepsMode, number> = {
      quick: 3,
      balanced: 7,
      deep: 15,
    };

    this.maxSteps = stepLimits[mode] || 7;
    this.budgets = { ...config.toolBudgets };
  }

  /**
   * Check if a tool can be invoked within budget
   */
  public canExecuteTool(toolName: string): { allowed: boolean; reason?: string; remaining: number } {
    const used = this.toolUsage[toolName] || 0;
    let limit = 10;

    if (toolName === "web_search" || toolName === "open_page") {
      limit = this.budgets.webSearch;
    } else if (toolName === "image_analysis_tool" || toolName.includes("vision")) {
      limit = this.budgets.vision;
    } else if (toolName === "coding_tool" || toolName === "code_tool") {
      limit = this.budgets.coding;
    } else if (toolName === "generate_image") {
      limit = this.budgets.imageGen;
    } else if (toolName === "calculator") {
      limit = this.budgets.calculator;
    } else if (toolName.startsWith("gmail_")) {
      limit = this.budgets.gmail;
    }

    if (used >= limit) {
      return {
        allowed: false,
        reason: `تم الوصول إلى الحد الأقصى المسموح لأداة ${toolName} في هذه المهمة (${limit} عمليات). يرجى الاعتماد على البيانات المجموعة.`,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      remaining: limit - used,
    };
  }

  /**
   * Record tool execution
   */
  public recordToolExecution(toolName: string): void {
    this.toolUsage[toolName] = (this.toolUsage[toolName] || 0) + 1;
  }

  /**
   * Check if iteration step is within allowed limit
   */
  public incrementAndCheckStep(): { shouldContinue: boolean; currentStep: number; maxSteps: number } {
    this.currentStep += 1;
    const shouldContinue = this.currentStep <= this.maxSteps;
    return {
      shouldContinue,
      currentStep: this.currentStep,
      maxSteps: this.maxSteps,
    };
  }

  public getCurrentStep(): number {
    return this.currentStep;
  }

  public getMaxSteps(): number {
    return this.maxSteps;
  }

  public getUsageSummary(): Record<string, number> {
    return { ...this.toolUsage };
  }
}
