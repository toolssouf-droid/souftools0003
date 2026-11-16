/**
 * SoufAI Nexus Engine — Skills Registry & On-Demand Composer
 *
 * Manages reusable skill registration, discovery, version constraints,
 * dependency resolution, permission compatibility validation, and
 * context-aware selective loading so agents never receive irrelevant skills.
 */

import { BUILTIN_NEXUS_SKILLS } from "./skillsCatalog";
import type {
  NexusAgentDefinition,
  NexusComposedSkillContext,
  NexusPermission,
  NexusSkillCategory,
  NexusSkillDefinition,
} from "./types";

function parseSemver(ver: string): [number, number, number] {
  const clean = (ver || "0.0.0").replace(/^[^\d]*/, "");
  const [maj = "0", min = "0", pat = "0"] = clean.split(".");
  return [parseInt(maj, 10) || 0, parseInt(min, 10) || 0, parseInt(pat, 10) || 0];
}

export function satisfiesVersionConstraint(version: string, constraint?: string): boolean {
  if (!constraint || constraint === "*") return true;
  const [vMaj, vMin, vPat] = parseSemver(version);

  if (constraint.startsWith(">=")) {
    const [cMaj, cMin, cPat] = parseSemver(constraint.slice(2));
    if (vMaj !== cMaj) return vMaj > cMaj;
    if (vMin !== cMin) return vMin > cMin;
    return vPat >= cPat;
  }

  if (constraint.startsWith("^")) {
    const [cMaj, cMin, cPat] = parseSemver(constraint.slice(1));
    if (vMaj !== cMaj) return false;
    if (vMin !== cMin) return vMin > cMin;
    return vPat >= cPat;
  }

  const [cMaj, cMin, cPat] = parseSemver(constraint);
  return vMaj === cMaj && vMin === cMin && vPat === cPat;
}

export class NexusSkillRegistry {
  private skills: Map<string, NexusSkillDefinition> = new Map();

  constructor(initialSkills: NexusSkillDefinition[] = BUILTIN_NEXUS_SKILLS) {
    for (const skill of initialSkills) {
      this.registerSkill(skill);
    }
  }

  public registerSkill(skill: NexusSkillDefinition): void {
    if (this.skills.has(skill.id)) {
      throw new Error(`NexusSkillRegistry: Skill ID '${skill.id}' is already registered.`);
    }
    this.validateSkill(skill);
    this.skills.set(skill.id, this.cloneSkill(skill));
  }

  public updateSkill(skillId: string, skill: NexusSkillDefinition): void {
    const current = this.skills.get(skillId);
    if (!current) {
      throw new Error(`NexusSkillRegistry: Skill '${skillId}' is not registered.`);
    }
    if (skill.id !== skillId || skill.version === current.version) {
      throw new Error(`NexusSkillRegistry: Updating '${skillId}' requires the same ID and a new version.`);
    }
    this.validateSkill(skill);
    this.skills.set(skillId, this.cloneSkill(skill));
  }

  private validateSkill(skill: NexusSkillDefinition): void {
    if (
      !skill.id?.trim() ||
      !skill.version?.trim() ||
      !skill.name?.trim() ||
      !skill.description?.trim() ||
      !skill.instructionBody?.trim() ||
      !Number.isFinite(skill.estimatedTokenCost) ||
      skill.estimatedTokenCost < 0 ||
      !Number.isFinite(skill.priority)
    ) {
      throw new Error(`NexusSkillRegistry: Skill '${skill.id || "(unknown)"}' has invalid metadata.`);
    }
    if (!Array.isArray(skill.dependencies) || !Array.isArray(skill.requiredPermissions)) {
      throw new Error(`NexusSkillRegistry: Skill '${skill.id}' has invalid dependency or permission metadata.`);
    }
  }

  private cloneSkill(skill: NexusSkillDefinition): NexusSkillDefinition {
    return {
      ...skill,
      triggerKeywords: [...(skill.triggerKeywords || [])],
      supportedTaskTypes: [...(skill.supportedTaskTypes || [])],
      compatibleAgents: [...(skill.compatibleAgents || [])],
      dependencies: [...(skill.dependencies || [])],
      requiredPermissions: [...(skill.requiredPermissions || [])],
    };
  }

  public getSkill(skillId: string): NexusSkillDefinition | undefined {
    return this.skills.get(skillId);
  }

  public setSkillEnabled(skillId: string, enabled: boolean): boolean {
    const existing = this.skills.get(skillId);
    if (!existing) return false;
    existing.enabled = enabled;
    return true;
  }

  public listSkills(filter?: {
    category?: NexusSkillCategory;
    enabledOnly?: boolean;
    compatibleAgentId?: string;
    taskType?: string;
  }): NexusSkillDefinition[] {
    let list = Array.from(this.skills.values());
    if (filter?.enabledOnly) {
      list = list.filter((s) => s.enabled);
    }
    if (filter?.category) {
      list = list.filter((s) => s.category === filter.category);
    }
    if (filter?.compatibleAgentId) {
      list = list.filter(
        (s) =>
          s.compatibleAgents.includes("*") ||
          s.compatibleAgents.includes(filter.compatibleAgentId!)
      );
    }
    if (filter?.taskType) {
      list = list.filter(
        (s) =>
          s.supportedTaskTypes.includes("*") ||
          s.supportedTaskTypes.includes(filter.taskType!)
      );
    }
    return list.sort((a, b) => b.priority - a.priority);
  }

  public resolveSkillDependencies(
    requestedSkillIds: string[],
    grantedPermissions?: NexusPermission[]
  ): {
    orderedSkillIds: string[];
    rejected: Array<{ skillId: string; reason: string }>;
  } {
    const ordered: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const rejected: Array<{ skillId: string; reason: string }> = [];
    const permSet = grantedPermissions ? new Set(grantedPermissions) : null;

    const visit = (skillId: string, constraint?: string): boolean => {
      if (visited.has(skillId)) return true;
      if (visiting.has(skillId)) {
        rejected.push({ skillId, reason: "Circular skill dependency detected" });
        return false;
      }

      const skill = this.skills.get(skillId);
      if (!skill) {
        rejected.push({ skillId, reason: "Skill not found in registry" });
        return false;
      }
      if (!skill.enabled) {
        rejected.push({ skillId, reason: "Skill is currently disabled" });
        return false;
      }
      if (!satisfiesVersionConstraint(skill.version, constraint)) {
        rejected.push({
          skillId,
          reason: `Version ${skill.version} does not satisfy ${constraint}`,
        });
        return false;
      }
      if (permSet && skill.requiredPermissions.length > 0) {
        const missing = skill.requiredPermissions.filter((p) => !permSet.has(p));
        if (missing.length > 0) {
          rejected.push({
            skillId,
            reason: `Missing permissions: ${missing.join(", ")}`,
          });
          return false;
        }
      }

      visiting.add(skillId);
      for (const dep of skill.dependencies || []) {
        const depOk = visit(dep.skillId, dep.versionConstraint);
        if (!depOk) {
          visiting.delete(skillId);
          rejected.push({
            skillId,
            reason: `Dependency '${dep.skillId}' failed validation`,
          });
          return false;
        }
      }
      visiting.delete(skillId);
      visited.add(skillId);
      ordered.push(skillId);
      return true;
    };

    for (const id of requestedSkillIds) {
      visit(id);
    }

    return { orderedSkillIds: ordered, rejected };
  }

  /**
   * Selects ONLY contextually relevant skills on demand within token budget.
   */
  public selectAndComposeForContext(params: {
    goal: string;
    taskType?: string;
    agent: NexusAgentDefinition;
    explicitSkillIds?: string[];
    effectivePermissions?: NexusPermission[];
    maxSkills?: number;
    maxSkillTokenBudget?: number;
  }): NexusComposedSkillContext {
    const {
      goal,
      taskType = "general",
      agent,
      explicitSkillIds = [],
      effectivePermissions = agent.permissionBoundaries,
      maxSkills = 5,
      maxSkillTokenBudget = 900,
    } = params;

    const lowerGoal = (goal || "").toLowerCase();
    const candidates = new Map<string, { skill: NexusSkillDefinition; score: number; reason: string }>();

    const consider = (skill: NexusSkillDefinition, baseBoost: number, baseReason: string) => {
      if (!skill.enabled) return;
      const agentCompatible =
        skill.compatibleAgents.includes("*") ||
        skill.compatibleAgents.includes(agent.id) ||
        skill.compatibleAgents.includes(agent.workerType);
      if (!agentCompatible) return;

      let score = baseBoost;
      const reasons: string[] = [baseReason];

      if (skill.supportedTaskTypes.includes(taskType)) {
        score += 30;
        reasons.push(`matches taskType:${taskType}`);
      } else if (skill.supportedTaskTypes.includes("*")) {
        score += 10;
      }

      let keywordHits = 0;
      for (const kw of skill.triggerKeywords) {
        if (lowerGoal.includes(kw.toLowerCase())) {
          keywordHits += 1;
        }
      }
      if (keywordHits > 0) {
        score += Math.min(45, keywordHits * 15);
        reasons.push(`${keywordHits} keyword matches`);
      }

      const prev = candidates.get(skill.id);
      if (!prev || score > prev.score) {
        candidates.set(skill.id, {
          skill,
          score,
          reason: reasons.join("; "),
        });
      }
    };

    // 1. Agent's required skills always get highest priority
    for (const reqId of agent.requiredSkills || []) {
      const sk = this.skills.get(reqId);
      if (sk) consider(sk, 100, `required by agent:${agent.id}`);
    }

    // 2. Caller explicitly requested skills
    for (const expId of explicitSkillIds) {
      const sk = this.skills.get(expId);
      if (sk) consider(sk, 85, "explicitly requested");
    }

    // 3. Agent optional skills + keyword-matched catalog skills
    for (const optId of agent.optionalSkills || []) {
      const sk = this.skills.get(optId);
      if (sk) consider(sk, 35, `optional for agent:${agent.id}`);
    }

    for (const sk of this.skills.values()) {
      consider(sk, 0, "contextual discovery");
    }

    const sorted = Array.from(candidates.values())
      .filter((c) => c.score >= 25)
      .sort((a, b) => b.score - a.score || b.skill.priority - a.skill.priority);

    // Pick within maxSkills & token budget (always keeping requiredSkills first)
    const selectedIds: string[] = [];
    let tokenAcc = 0;
    for (const entry of sorted) {
      const isRequired = agent.requiredSkills.includes(entry.skill.id);
      if (!isRequired) {
        if (selectedIds.length >= maxSkills) continue;
        if (tokenAcc + entry.skill.estimatedTokenCost > maxSkillTokenBudget) continue;
      }
      selectedIds.push(entry.skill.id);
      tokenAcc += entry.skill.estimatedTokenCost;
    }

    const { orderedSkillIds, rejected } = this.resolveSkillDependencies(
      selectedIds,
      effectivePermissions
    );

    const activations: NexusComposedSkillContext["activations"] = [];
    const bodies: string[] = [];
    let actualTokens = 0;

    for (const id of orderedSkillIds) {
      const sk = this.skills.get(id);
      if (!sk) continue;
      const meta = candidates.get(id);
      actualTokens += sk.estimatedTokenCost;
      activations.push({
        skillId: sk.id,
        version: sk.version,
        relevanceScore: meta?.score ?? 50,
        reason: meta?.reason ?? "dependency",
        estimatedTokens: sk.estimatedTokenCost,
      });
      bodies.push(sk.instructionBody);
    }

    const fullCatalogTokens = Array.from(this.skills.values())
      .filter((s) => s.enabled)
      .reduce((sum, s) => sum + s.estimatedTokenCost, 0);

    return {
      activeSkillIds: orderedSkillIds,
      resolvedOrder: orderedSkillIds,
      rejectedSkills: rejected,
      totalEstimatedTokens: actualTokens,
      tokensSavedVsFullCatalog: Math.max(0, fullCatalogTokens - actualTokens),
      mergedInstructions: bodies.join("\n\n"),
      activations,
    };
  }
}

export const nexusSkillRegistry = new NexusSkillRegistry();
