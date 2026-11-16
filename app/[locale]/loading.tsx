"use client";

import React from "react";
import { SoufToolsLogo } from "@/components/ui/Logos";

export default function Loading() {
  return (
    <div className="min-h-screen w-full bg-[#0a0f0f] flex flex-col items-center justify-center p-4 select-none z-50">
      <div className="relative flex flex-col items-center gap-4">
        {/* Glowing pulse aura */}
        <div className="absolute -inset-4 bg-gradient-to-r from-[#00d4aa]/20 to-[#0ea5e9]/20 rounded-full blur-xl animate-pulse" />
        
        {/* Animated Brand Logo */}
        <div className="relative w-14 h-14 rounded-2xl bg-[#0f1717] border border-[#00d4aa]/30 flex items-center justify-center shadow-lg shadow-[#00d4aa]/15 animate-bounce">
          <SoufToolsLogo className="w-8 h-8 text-[#00d4aa]" />
        </div>

        {/* Minimalist spinner & brand name */}
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 rounded-full bg-[#00d4aa] animate-ping" />
          <span className="text-xs font-mono font-bold tracking-widest text-[#00d4aa] uppercase">
            SoufTools
          </span>
          <div className="w-2 h-2 rounded-full bg-[#0ea5e9] animate-ping delay-150" />
        </div>
      </div>
    </div>
  );
}
