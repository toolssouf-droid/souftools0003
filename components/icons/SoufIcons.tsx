"use client";

import React from "react";

export type IconState = "default" | "active" | "hover" | "loading" | "success" | "error" | "disabled";

export interface SoufIconProps {
  size?: number;
  className?: string;
  state?: IconState;
  glow?: boolean;
  accentColor?: string;
}

/**
 * Base wrapper that applies standard geometric scaling, lighting, and state styling.
 */
function getIconStateClasses(state: IconState = "default", disabled = false): string {
  if (disabled || state === "disabled") {
    return "opacity-40 grayscale cursor-not-allowed";
  }
  switch (state) {
    case "active":
      return "scale-105 filter drop-shadow-[0_0_8px_currentColor]";
    case "hover":
      return "transition-transform duration-200 hover:scale-110";
    case "loading":
      return "animate-spin";
    case "success":
      return "text-emerald-400 filter drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]";
    case "error":
      return "text-rose-500 filter drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]";
    default:
      return "transition-all duration-200";
  }
}

// ============================================================================
// 1. SoufAI Icon (Platform Neural Core)
// ============================================================================
export const SoufAIIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  glow = false,
  accentColor = "#00d4aa",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <defs>
        <linearGradient id="souf_ai_grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor={accentColor} />
          <stop offset="0.6" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      {glow && (
        <circle cx="16" cy="16" r="12" fill={accentColor} opacity="0.15" filter="blur(4px)" />
      )}
      {/* Outer Hexagon Shield */}
      <path
        d="M16 3L27 9.5V22.5L16 29L5 22.5V9.5L16 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />
      {/* Inner Dynamic S-Neural Core */}
      <path
        d="M21 11C21 9.34315 19.6569 8 18 8H14C12.3431 8 11 9.34315 11 11C11 12.6569 12.3431 14 14 14H18C19.6569 14 21 15.3431 21 17C21 18.6569 19.6569 20 18 20H14C12.3431 20 11 18.6569 11 17"
        stroke="url(#souf_ai_grad)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="21" cy="11" r="1.5" fill={accentColor} />
      <circle cx="11" cy="17" r="1.5" fill="#0ea5e9" />
      <circle cx="16" cy="14" r="1" fill="#e8f5f5" />
    </svg>
  );
};

// ============================================================================
// 2. SoufSparkIcon (Speed & Instant Lightning)
// ============================================================================
export const SoufSparkIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  glow = false,
  accentColor = "#f59e0b",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <defs>
        <linearGradient id="souf_spark_grad" x1="8" y1="4" x2="24" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {glow && <circle cx="16" cy="16" r="10" fill={accentColor} opacity="0.2" filter="blur(4px)" />}
      {/* Outer Speed Diamond */}
      <rect
        x="6"
        y="6"
        width="20"
        height="20"
        rx="5"
        transform="rotate(45 16 16)"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.08"
      />
      {/* High-voltage Lightning Bolt */}
      <path
        d="M17.5 5L9.5 16H16L14.5 27L22.5 15H16L17.5 5Z"
        fill="url(#souf_spark_grad)"
        stroke="#fde68a"
        strokeWidth="0.75"
        strokeLinejoin="miter"
      />
    </svg>
  );
};

// ============================================================================
// 3. SoufCoreIcon (Balanced Daily Driver)
// ============================================================================
export const SoufCoreIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  glow = false,
  accentColor = "#0ea5e9",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <defs>
        <linearGradient id="souf_core_grad" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      {glow && <circle cx="16" cy="16" r="10" fill={accentColor} opacity="0.2" filter="blur(4px)" />}
      {/* Outer Rounded Box */}
      <rect x="5" y="5" width="22" height="22" rx="6" stroke="currentColor" strokeWidth="1.75" fill="currentColor" fillOpacity="0.08" />
      {/* Concentric Balance Rings */}
      <circle cx="16" cy="16" r="7" stroke="url(#souf_core_grad)" strokeWidth="1.75" />
      <circle cx="16" cy="16" r="3" fill="#e0f2fe" />
      <line x1="16" y1="5" x2="16" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="24" x2="16" y2="27" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="16" x2="8" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="16" x2="27" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

// ============================================================================
// 4. SoufProIcon (Deep Reasoning & Research)
// ============================================================================
export const SoufProIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  glow = false,
  accentColor = "#a855f7",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <defs>
        <linearGradient id="souf_pro_grad" x1="4" y1="8" x2="28" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c084fc" />
          <stop offset="1" stopColor="#7e22ce" />
        </linearGradient>
      </defs>
      {glow && <circle cx="16" cy="16" r="10" fill={accentColor} opacity="0.25" filter="blur(4px)" />}
      {/* Faceted Gemstone Pro Geometry */}
      <path
        d="M9 7L23 7L28 13L16 27L4 13L9 7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path d="M4 13H28" stroke="url(#souf_pro_grad)" strokeWidth="1.25" />
      <path d="M9 7L13 13L16 27L19 13L23 7" stroke="url(#souf_pro_grad)" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
};

// ============================================================================
// 5. SoufCoderIcon (Software Engineering & Architecture)
// ============================================================================
export const SoufCoderIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  glow = false,
  accentColor = "#10b981",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <defs>
        <linearGradient id="souf_coder_grad" x1="5" y1="5" x2="27" y2="27" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      {glow && <circle cx="16" cy="16" r="10" fill={accentColor} opacity="0.2" filter="blur(4px)" />}
      {/* Code Terminal Chassis */}
      <rect x="4" y="5" width="24" height="22" rx="5" stroke="currentColor" strokeWidth="1.75" fill="currentColor" fillOpacity="0.08" />
      <line x1="4" y1="11" x2="28" y2="11" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <circle cx="8" cy="8" r="1" fill="#ef4444" />
      <circle cx="11" cy="8" r="1" fill="#f59e0b" />
      <circle cx="14" cy="8" r="1" fill="#10b981" />
      {/* Code Brackets < / > */}
      <path d="M12 16L9 19L12 22" stroke="url(#souf_coder_grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16L23 19L20 22" stroke="url(#souf_coder_grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 15L15 23" stroke="#e8f5f5" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
};

// ============================================================================
// 6. SoufUltraIcon (Apex Intelligence & Agency)
// ============================================================================
export const SoufUltraIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  glow = false,
  accentColor = "#f43f5e",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <defs>
        <linearGradient id="souf_ultra_grad" x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fb7185" />
          <stop offset="0.5" stopColor="#f43f5e" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      {glow && <circle cx="16" cy="16" r="11" fill={accentColor} opacity="0.25" filter="blur(5px)" />}
      {/* Double Crown Rocket Apex Star */}
      <path
        d="M16 3L19.5 11.5L28 13L21.5 19L23.5 28L16 23.5L8.5 28L10.5 19L4 13L12.5 11.5L16 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <circle cx="16" cy="16" r="4.5" fill="url(#souf_ultra_grad)" stroke="#fff" strokeWidth="0.75" />
      <circle cx="16" cy="16" r="1.5" fill="#ffffff" />
    </svg>
  );
};

// ============================================================================
// 7. SoufAgentIcon (Autonomous Multi-Step Agent)
// ============================================================================
export const SoufAgentIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  accentColor = "#00d4aa",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.75" strokeDasharray="3 3" />
      <circle cx="16" cy="16" r="6" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1" />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" />
      <circle cx="16" cy="4" r="2" fill="currentColor" />
      <circle cx="28" cy="16" r="2" fill="currentColor" />
      <circle cx="16" cy="28" r="2" fill="currentColor" />
      <circle cx="4" cy="16" r="2" fill="currentColor" />
    </svg>
  );
};

// ============================================================================
// 8. SoufSandboxIcon (Isolated Execution Environment)
// ============================================================================
export const SoufSandboxIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  accentColor = "#38bdf8",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      {/* 3D Isometric Cube Box */}
      <path d="M16 4L27 10V22L16 28L5 22V10L16 4Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" fill="currentColor" fillOpacity="0.08" />
      <path d="M16 4V16L27 22" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 16L5 22" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
};

// ============================================================================
// 9. SoufResearchIcon (Web Grounding & Deep Research)
// ============================================================================
export const SoufResearchIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  accentColor = "#06b6d4",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.08" />
      <path d="M20 20L27 27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="14" cy="14" rx="7.5" ry="3.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="14" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
};

// ============================================================================
// 10. SoufVisionIcon (Multimodal & Visual Understanding)
// ============================================================================
export const SoufVisionIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  accentColor = "#ec4899",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <path
        d="M4 16C7 9.5 11 6 16 6C21 6 25 9.5 28 16C25 22.5 21 26 16 26C11 26 7 22.5 4 16Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
      <circle cx="17.5" cy="14.5" r="0.8" fill="#ffffff" />
    </svg>
  );
};

// ============================================================================
// 11. SoufMemoryIcon (Persistent Vector & Graph Memory)
// ============================================================================
export const SoufMemoryIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  accentColor = "#8b5cf6",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      {/* Stylized Brain Hemisphere Circuit */}
      <path
        d="M16 6V26M16 6C13 6 10 7.5 9 10C7.5 11.5 7 13.5 7 16C7 19.5 9 22 11.5 23.5L16 26M16 6C19 6 22 7.5 23 10C24.5 11.5 25 13.5 25 16C25 19.5 23 22 20.5 23.5L16 26"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="14" r="1.5" fill="currentColor" />
      <circle cx="21" cy="14" r="1.5" fill="currentColor" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
};

// ============================================================================
// 12. SoufSyncIcon (Bidirectional Cloud Synchronizer)
// ============================================================================
export const SoufSyncIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  accentColor = "#14b8a6",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <path
        d="M6 16C6 10.4772 10.4772 6 16 6C19.5 6 22.6 7.8 24.4 10.5M25 6V11H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 16C26 21.5228 21.5228 26 16 26C12.5 26 9.4 24.2 7.6 21.5M7 26V21H12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ============================================================================
// 13. SoufSecurityIcon (Vault & RBAC Protection)
// ============================================================================
export const SoufSecurityIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  accentColor = "#22c55e",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <path
        d="M16 4L6 8V16C6 22.5 10.5 27.5 16 29C21.5 27.5 26 22.5 26 16V8L16 4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path d="M12 16L15 19L20 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ============================================================================
// 14. SoufAnalyticsIcon (Metrics & Telemetry Stream)
// ============================================================================
export const SoufAnalyticsIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  accentColor = "#6366f1",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <path d="M5 27H27" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <rect x="7" y="17" width="4" height="7" rx="1.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="11" width="4" height="13" rx="1.5" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="21" y="6" width="4" height="18" rx="1.5" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 14L15 8L23 4" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.5 1.5" />
    </svg>
  );
};

// ============================================================================
// 15. SoufToolsIcon (Tool Ecosystem)
// ============================================================================
export const SoufToolsIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  accentColor = "#f97316",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <path
        d="M21 5C20 4 18 4 17 5L15 7L19 11L21 9C22 8 22 6 21 5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path d="M15 7L7 15C6.5 15.5 6.5 16.5 7 17L9 19C9.5 19.5 10.5 19.5 11 19L19 11" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 24L5 27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="23" cy="23" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="23" cy="23" r="1.5" fill="currentColor" />
    </svg>
  );
};

// ============================================================================
// 16. SoufFilesIcon (SoufFile Storage & Artifacts)
// ============================================================================
export const SoufFilesIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  accentColor = "#3b82f6",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <path
        d="M7 5H19L25 11V27H7V5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path d="M18 5V12H25" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="11" y1="16" x2="21" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="20" x2="19" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

// ============================================================================
// 17. SoufPerformanceIcon (Latency, Throughput, Benchmarks)
// ============================================================================
export const SoufPerformanceIcon: React.FC<SoufIconProps> = ({
  size = 24,
  className = "",
  state = "default",
  accentColor = "#eab308",
}) => {
  const stateCls = getIconStateClasses(state);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${stateCls} ${className}`}
      style={{ color: accentColor }}
    >
      <path
        d="M6 21C6 15.4772 10.4772 11 16 11C21.5228 11 26 15.4772 26 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="21" r="3" fill="currentColor" />
      <path d="M16 21L21 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="21" x2="8" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="21" x2="22" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="15" x2="16" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

/**
 * Universal Icon Resolver by Model ID
 */
export function getModelIcon(modelId: string, props: SoufIconProps = {}) {
  const cleanId = (modelId || "").toLowerCase();
  switch (cleanId) {
    case "spark":
      return <SoufSparkIcon {...props} />;
    case "core":
      return <SoufCoreIcon {...props} />;
    case "pro":
      return <SoufProIcon {...props} />;
    case "coder":
      return <SoufCoderIcon {...props} />;
    case "ultra":
      return <SoufUltraIcon {...props} />;
    case "vision":
      return <SoufVisionIcon {...props} />;
    default:
      return <SoufAIIcon {...props} />;
  }
}

/**
 * Universal Tool Icon Resolver by Tool ID
 */
export function getToolIcon(toolId: string, props: SoufIconProps = {}) {
  const cleanId = (toolId || "").toLowerCase();
  switch (cleanId) {
    case "sandbox":
      return <SoufSandboxIcon {...props} />;
    case "tools":
      return <SoufToolsIcon {...props} />;
    case "terminal":
    case "code_execution":
      return <SoufCoderIcon {...props} />;
    case "web_search":
    case "browser":
    case "research":
      return <SoufResearchIcon {...props} />;
    case "document_parser":
    case "file_system":
      return <SoufFilesIcon {...props} />;
    case "agent":
      return <SoufAgentIcon {...props} />;
    case "vision":
      return <SoufVisionIcon {...props} />;
    case "memory":
    case "database":
      return <SoufMemoryIcon {...props} />;
    default:
      return <SoufToolsIcon {...props} />;
  }
}

