"use client";

import React, { useState } from "react";
import { Brain, Check, Sparkles, X } from "lucide-react";
import { MemoryCandidate, SoufAIMemory } from "@/lib/memory/types";

interface MemoryBadgeProps {
  usedMemories?: any[];
  candidateMemory?: any;
  userId?: string;
  onSaveCandidate?: (candidate: MemoryCandidate) => void;
  isRtl?: boolean;
}

export const MemoryBadge: React.FC<MemoryBadgeProps> = () => {
  return null;
};
