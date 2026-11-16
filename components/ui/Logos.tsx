"use client";

import React from "react";

export interface LogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
  showText?: boolean;
}

/**
 * 1. SoufTools Platform Official Main Logo
 * High-tech cybernetic emblem with stylized neural S-core, gradient aura, and typography.
 */
export const SoufToolsLogo: React.FC<LogoProps> = ({
  size = 38,
  className = "",
  glow = true,
  showText = false,
}) => {
  return (
    <div className={`relative inline-flex items-center gap-3 ${className}`}>
      <div className="relative inline-flex items-center justify-center shrink-0">
        {glow && (
          <div
            className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-[#00d4aa] via-[#00ff88] to-[#0ea5e9] opacity-50 blur-lg animate-pulse"
            style={{ width: size + 8, height: size + 8 }}
          />
        )}
        <div
          className="relative rounded-2xl bg-gradient-to-br from-[#111c1c] via-[#0d1616] to-[#080d0d] border border-[#00ff88]/40 p-2 flex items-center justify-center shadow-2xl text-[#00ff88]"
          style={{ width: size, height: size }}
        >
          <svg
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-[0_0_8px_rgba(0,255,136,0.5)]"
          >
            {/* Outer Cyber Shield Octagon */}
            <path
              d="M13 5H27L35 13V27L27 35H13L5 27V13L13 5Z"
              fill="#0b1414"
              stroke="url(#souf_plat_border)"
              strokeWidth="2.2"
            />
            {/* Inner Tech Grid lines */}
            <line x1="5" y1="20" x2="35" y2="20" stroke="#00ff88" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.3" />
            <line x1="20" y1="5" x2="20" y2="35" stroke="#00ff88" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.3" />

            {/* Futuristic Central S-Curve Neural Circuit */}
            <path
              d="M26 12C26 9.79086 24.2091 8 22 8H16C13.2386 8 11 10.2386 11 13V15C11 17.7614 13.2386 20 16 20H24C26.7614 20 29 22.2386 29 25V27C29 29.7614 26.7614 32 24 32H18C15.7909 32 14 30.2091 14 28"
              stroke="url(#souf_plat_core)"
              strokeWidth="3.8"
              strokeLinecap="round"
            />
            {/* Glowing AI Circuit Nodes */}
            <circle cx="28" cy="12" r="2.8" fill="#00ff88" />
            <circle cx="12" cy="28" r="2.8" fill="#0ea5e9" />
            <circle cx="20" cy="20" r="2" fill="#ffffff" />

            <defs>
              <linearGradient id="souf_plat_border" x1="5" y1="5" x2="35" y2="35" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00d4aa" />
                <stop offset="0.5" stopColor="#00ff88" />
                <stop offset="1" stopColor="#0ea5e9" />
              </linearGradient>
              <linearGradient id="souf_plat_core" x1="11" y1="8" x2="29" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00ff88" />
                <stop offset="0.5" stopColor="#00d4aa" />
                <stop offset="1" stopColor="#38ef7d" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      {showText && (
        <div className="flex flex-col text-right">
          <span className="text-base font-black tracking-tight bg-gradient-to-r from-[#e8f5f5] via-[#00ff88] to-[#00d4aa] bg-clip-text text-transparent flex items-center gap-1.5">
            SoufTools
            <span className="text-[9px] bg-[#00ff88]/15 text-[#00ff88] px-1.5 py-0.5 rounded-full border border-[#00ff88]/30 font-mono font-bold tracking-wide">
              AI V2
            </span>
          </span>
          <span className="text-[10px] font-bold text-[#4a7070] tracking-widest uppercase -mt-0.5">
            المنصة الذكية المتكاملة
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * 2. SoufSpark Logo (⚡ Lightning Speed & Energy)
 */
export const SoufSparkLogo: React.FC<LogoProps> = ({ size = 28, className = "" }) => {
  return (
    <div
      className={`rounded-xl bg-gradient-to-br from-amber-500/25 via-orange-950/40 to-[#0c0904] border border-amber-400/50 text-amber-300 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20 relative group ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3/5 h-3/5 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
        {/* Dual Interlocking Lightning Bolts */}
        <path d="M19 3L7 17H16L13 29L25 15H16L19 3Z" fill="url(#spark_grad)" stroke="#fde047" strokeWidth="1.2" strokeLinejoin="round" />
        {/* Speed trails */}
        <line x1="5" y1="10" x2="8" y2="10" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="3" y1="18" x2="7" y2="18" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="26" cy="7" r="1.5" fill="#fde047" />
        <defs>
          <linearGradient id="spark_grad" x1="7" y1="3" x2="25" y2="29" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fbbf24" />
            <stop offset="0.5" stopColor="#f59e0b" />
            <stop offset="1" stopColor="#d97706" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

/**
 * 3. SoufCore Logo (🔵 Quantum Intelligence Core)
 */
export const SoufCoreLogo: React.FC<LogoProps> = ({ size = 28, className = "" }) => {
  return (
    <div
      className={`rounded-xl bg-gradient-to-br from-[#00d4aa]/25 via-[#0d2624] to-[#060f0f] border border-[#00ff88]/50 text-[#00ff88] flex items-center justify-center shrink-0 shadow-lg shadow-[#00ff88]/20 relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3/5 h-3/5 drop-shadow-[0_0_6px_rgba(0,255,136,0.6)]">
        {/* Outer Quantum Orbit Ring */}
        <ellipse cx="16" cy="16" rx="12" ry="5" stroke="url(#core_ring1)" strokeWidth="1.8" transform="rotate(-30 16 16)" />
        <ellipse cx="16" cy="16" rx="12" ry="5" stroke="url(#core_ring2)" strokeWidth="1.8" transform="rotate(30 16 16)" />
        {/* Core Energy Orb */}
        <circle cx="16" cy="16" r="4.5" fill="url(#core_orb)" stroke="#ffffff" strokeWidth="0.8" />
        <circle cx="16" cy="16" r="2" fill="#ffffff" />
        {/* Electrons */}
        <circle cx="25" cy="11" r="1.5" fill="#00ff88" />
        <circle cx="7" cy="21" r="1.5" fill="#0ea5e9" />
        <defs>
          <linearGradient id="core_ring1" x1="4" y1="11" x2="28" y2="21">
            <stop stopColor="#00ff88" />
            <stop offset="1" stopColor="#00d4aa" />
          </linearGradient>
          <linearGradient id="core_ring2" x1="4" y1="11" x2="28" y2="21">
            <stop stopColor="#0ea5e9" />
            <stop offset="1" stopColor="#00ff88" />
          </linearGradient>
          <radialGradient id="core_orb" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(16 16) scale(4.5)">
            <stop stopColor="#00ff88" />
            <stop offset="1" stopColor="#059669" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
};

/**
 * 4. SoufPro Logo (💎 Deep Reasoning Neural Prism)
 */
export const SoufProLogo: React.FC<LogoProps> = ({ size = 28, className = "" }) => {
  return (
    <div
      className={`rounded-xl bg-gradient-to-br from-purple-500/25 via-purple-950/40 to-[#0e0714] border border-purple-400/50 text-purple-300 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20 relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3/5 h-3/5 drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]">
        {/* Faceted Reasoning Crystal Diamond */}
        <polygon points="16,3 27,11 16,29 5,11" fill="url(#pro_facets)" stroke="#c084fc" strokeWidth="1.5" strokeLinejoin="round" />
        {/* Inner Prism facets lines */}
        <line x1="16" y1="3" x2="16" y2="29" stroke="#e9d5ff" strokeWidth="1.2" />
        <line x1="5" y1="11" x2="27" y2="11" stroke="#e9d5ff" strokeWidth="1.2" />
        <line x1="10" y1="11" x2="16" y2="29" stroke="#a855f7" strokeWidth="1" />
        <line x1="22" y1="11" x2="16" y2="29" stroke="#a855f7" strokeWidth="1" />
        {/* Center Neural Core */}
        <circle cx="16" cy="11" r="2" fill="#ffffff" />
        <defs>
          <linearGradient id="pro_facets" x1="5" y1="3" x2="27" y2="29" gradientUnits="userSpaceOnUse">
            <stop stopColor="#c084fc" />
            <stop offset="0.5" stopColor="#9333ea" />
            <stop offset="1" stopColor="#581c87" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

/**
 * 5. SoufCoder Logo (💻 Software Engineer Terminal Chip)
 */
export const SoufCoderLogo: React.FC<LogoProps> = ({ size = 28, className = "" }) => {
  return (
    <div
      className={`rounded-xl bg-gradient-to-br from-cyan-500/25 via-cyan-950/40 to-[#040e14] border border-cyan-400/50 text-cyan-300 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20 relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3/5 h-3/5 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]">
        {/* Hexagonal Processor Frame */}
        <polygon points="16,4 27,10 27,22 16,28 5,22 5,10" fill="#082f49" stroke="url(#coder_grad)" strokeWidth="1.8" />
        {/* Nested Brackets < /> */}
        <path d="M12 11L8 16L12 21" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 11L24 16L20 21" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="17" y1="11" x2="15" y2="21" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
        <defs>
          <linearGradient id="coder_grad" x1="5" y1="4" x2="27" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop offset="1" stopColor="#0891b2" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

/**
 * 6. SoufUltra Logo (🚀 Flagship Supersonic Starburst)
 */
export const SoufUltraLogo: React.FC<LogoProps> = ({ size = 28, className = "" }) => {
  return (
    <div
      className={`rounded-xl bg-gradient-to-br from-rose-500/25 via-rose-950/40 to-[#140407] border border-rose-400/50 text-rose-300 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20 relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3/5 h-3/5 drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]">
        {/* Supersonic Apex Rocket / Starburst */}
        <path
          d="M16 3C16 3 20 9 22 14C24 19 23 25 23 25L16 21L9 25C9 25 8 19 10 14C12 9 16 3 16 3Z"
          fill="url(#ultra_grad)"
          stroke="#fda4af"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Thruster Flame Energy */}
        <path d="M16 21L13 29L16 26L19 29L16 21Z" fill="#f43f5e" stroke="#ffe4e6" strokeWidth="0.8" />
        {/* Radiant Star Core */}
        <circle cx="16" cy="13" r="2" fill="#ffffff" />
        <line x1="16" y1="8" x2="16" y2="18" stroke="#ffe4e6" strokeWidth="1" strokeLinecap="round" />
        <defs>
          <linearGradient id="ultra_grad" x1="9" y1="3" x2="23" y2="25" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fb7185" />
            <stop offset="0.5" stopColor="#e11d48" />
            <stop offset="1" stopColor="#881337" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

/**
 * 7. SoufVision Logo (👁️ Cybernetic Optics Aperture Lens)
 */
export const SoufVisionLogo: React.FC<LogoProps> = ({ size = 28, className = "" }) => {
  return (
    <div
      className={`rounded-xl bg-gradient-to-br from-blue-500/25 via-blue-950/40 to-[#040814] border border-blue-400/50 text-blue-300 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3/5 h-3/5 drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]">
        {/* Outer Cyber Eye Shape */}
        <path
          d="M3 16C3 16 8 8 16 8C24 8 29 16 29 16C29 16 24 24 16 24C8 24 3 16 3 16Z"
          fill="#0f172a"
          stroke="url(#vision_grad)"
          strokeWidth="1.8"
        />
        {/* Iris Lens Aperture Ring */}
        <circle cx="16" cy="16" r="6" stroke="#60a5fa" strokeWidth="1.5" fill="#1e3a8a" />
        {/* Iris Pupil Target */}
        <circle cx="16" cy="16" r="2.5" fill="#ffffff" />
        {/* Reticle Target Crosshairs */}
        <line x1="16" y1="4" x2="16" y2="7" stroke="#60a5fa" strokeWidth="1.5" />
        <line x1="16" y1="25" x2="16" y2="28" stroke="#60a5fa" strokeWidth="1.5" />
        <line x1="1" y1="16" x2="4" y2="16" stroke="#60a5fa" strokeWidth="1.5" />
        <line x1="28" y1="16" x2="31" y2="16" stroke="#60a5fa" strokeWidth="1.5" />
        <defs>
          <linearGradient id="vision_grad" x1="3" y1="8" x2="29" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#60a5fa" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

/**
 * 8. SoufWriter Logo (✍️ Arabic Calligraphy Stylus & Spark Wave)
 */
export const SoufWriterLogo: React.FC<LogoProps> = ({ size = 28, className = "" }) => {
  return (
    <div
      className={`rounded-xl bg-gradient-to-br from-emerald-500/25 via-emerald-950/40 to-[#04140b] border border-emerald-400/50 text-emerald-300 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20 relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3/5 h-3/5 drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]">
        {/* Calligraphy Feather Nib & Arabic Curve */}
        <path
          d="M26 4C26 4 18 8 13 15C8 22 7 27 7 27L12 26C12 26 15 21 21 15C27 9 26 4 26 4Z"
          fill="url(#writer_grad)"
          stroke="#6ee7b7"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Ink Line Nib Split */}
        <line x1="26" y1="4" x2="15" y2="18" stroke="#042f2e" strokeWidth="1" />
        {/* Arabic Script Wave Accent */}
        <path d="M5 24C8 22 12 25 15 23C18 21 22 25 25 22" stroke="#fef08a" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="25" cy="22" r="1.5" fill="#fde047" />
        <defs>
          <linearGradient id="writer_grad" x1="7" y1="4" x2="26" y2="27" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34d399" />
            <stop offset="0.6" stopColor="#059669" />
            <stop offset="1" stopColor="#064e3b" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

/**
 * 9. SoufLiteFree Logo (🛡️ Efficient Shield Aegis)
 */
export const SoufLiteFreeLogo: React.FC<LogoProps> = ({ size = 28, className = "" }) => {
  return (
    <div
      className={`rounded-xl bg-gradient-to-br from-teal-500/25 via-teal-950/40 to-[#041212] border border-teal-400/50 text-teal-300 flex items-center justify-center shrink-0 shadow-lg shadow-teal-500/20 relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3/5 h-3/5 drop-shadow-[0_0_6px_rgba(20,184,166,0.6)]">
        {/* Aegis Cyber Shield */}
        <path
          d="M16 4L26 8V16C26 22 21 26.5 16 28C11 26.5 6 22 6 16V8L16 4Z"
          fill="#042f2e"
          stroke="url(#lite_grad)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Fast Checkmark Lightning emblem */}
        <path d="M11 16L15 20L21 11" stroke="#5eead4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="lite_grad" x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2dd4bf" />
            <stop offset="1" stopColor="#0f766e" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

/**
 * 10. SoufAgent Logo (🤖 Autonomous AI Sentinel Visor)
 */
export const SoufAgentLogo: React.FC<LogoProps> = ({ size = 28, className = "" }) => {
  return (
    <div
      className={`rounded-xl bg-gradient-to-tr from-[#00ff88] via-[#00d4aa] to-[#0ea5e9] text-[#050b0b] flex items-center justify-center shrink-0 shadow-xl shadow-[#00ff88]/30 relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3/5 h-3/5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
        {/* Autonomous Agent Head / Helmet */}
        <path
          d="M8 12C8 8.68629 10.6863 6 14 6H18C21.3137 6 24 8.68629 24 12V22C24 24.2091 22.2091 26 20 26H12C9.79086 26 8 24.2091 8 22V12Z"
          fill="#081414"
          stroke="#ffffff"
          strokeWidth="1.5"
        />
        {/* Glowing Cybernetic Optics Visor */}
        <rect x="10" y="11" width="12" height="5" rx="2.5" fill="url(#agent_visor)" stroke="#00ff88" strokeWidth="0.8" />
        {/* Dual Optic Pupil Lights */}
        <circle cx="13" cy="13.5" r="1" fill="#ffffff" />
        <circle cx="19" cy="13.5" r="1" fill="#ffffff" />
        {/* Neural Antenna Node */}
        <line x1="16" y1="6" x2="16" y2="3" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx="16" cy="2" r="1.5" fill="#00ff88" />
        <defs>
          <linearGradient id="agent_visor" x1="10" y1="11" x2="22" y2="16" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00ff88" />
            <stop offset="1" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

/**
 * Dynamic Universal Model & Agent Logo Resolver
 */
export const ModelLogo: React.FC<{ modelId?: string; size?: number; className?: string }> = ({
  modelId = "core",
  size = 28,
  className = "",
}) => {
  const cleanId = (modelId || "")
    .toLowerCase()
    .replace(/^soufai-?/, "")
    .replace(/[^a-z0-9_]/g, "_");

  // Helper to resolve specific model names to our canonical tier logos
  let resolvedId = cleanId;

  // Pattern check for provider models to map them to the closest canonical tier
  if (cleanId.includes("spark")) {
    resolvedId = "spark";
  } else if (cleanId.includes("ultra") || cleanId.includes("reasoner") || cleanId === "o1" || cleanId.includes("o1_") || cleanId === "o3_mini") {
    resolvedId = "ultra";
  } else if (cleanId.includes("coder") || cleanId.includes("qwen") || cleanId.includes("code")) {
    resolvedId = "coder";
  } else if (cleanId.includes("vision") || cleanId.includes("pixtral")) {
    resolvedId = "vision";
  } else if (cleanId.includes("writer") || cleanId.includes("cohere") || cleanId.includes("command_r") || cleanId.includes("mistral_large")) {
    resolvedId = "writer";
  } else if (cleanId.includes("lite_free") || cleanId.includes("litefree") || cleanId === "lite" || cleanId.includes("free") || cleanId.includes("llama_3_1_8b")) {
    resolvedId = "lite_free";
  } else if (cleanId.includes("pro") || cleanId.includes("sonnet") || cleanId.includes("claude") || cleanId.includes("gpt_4o")) {
    resolvedId = "pro";
  } else if (cleanId.includes("flash_lite")) {
    resolvedId = "spark";
  } else if (cleanId.includes("classifier")) {
    resolvedId = "classifier";
  } else if (cleanId.includes("flash") || cleanId.includes("mini") || cleanId.includes("llama_3_3")) {
    resolvedId = "core";
  } else if (cleanId.includes("agent")) {
    resolvedId = "agent";
  }

  switch (resolvedId) {
    case "classifier":
      return (
        <div
          className={`rounded-xl bg-gradient-to-br from-purple-500/25 via-purple-950/40 to-[#120419] border border-purple-400/50 text-purple-300 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20 relative ${className}`}
          style={{ width: size, height: size }}
        >
          <span style={{ fontSize: size * 0.55 }}>🎯</span>
        </div>
      );
    case "spark":
      return <SoufSparkLogo size={size} className={className} />;
    case "core":
      return <SoufCoreLogo size={size} className={className} />;
    case "pro":
      return <SoufProLogo size={size} className={className} />;
    case "coder":
      return <SoufCoderLogo size={size} className={className} />;
    case "ultra":
      return <SoufUltraLogo size={size} className={className} />;
    case "vision":
      return <SoufVisionLogo size={size} className={className} />;
    case "writer":
      return <SoufWriterLogo size={size} className={className} />;
    case "lite_free":
    case "litefree":
    case "lite":
      return <SoufLiteFreeLogo size={size} className={className} />;
    case "agent":
      return <SoufAgentLogo size={size} className={className} />;
    default:
      return <SoufCoreLogo size={size} className={className} />;
  }
};
