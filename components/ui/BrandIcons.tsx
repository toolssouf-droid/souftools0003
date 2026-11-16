"use client";

import React from "react";

export interface BrandIconProps {
  size?: number;
  className?: string;
  glow?: boolean;
  color?: string;
}

/**
 * SoufTools Custom Brand Icon System
 * Unique cybernetic, high-tech SVG icon set tailored specifically for SoufTools platform identity.
 */

// 1. New Chat / Plus Icon (Cybernetic Conversation Node)
export const SoufChatPlusIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#00ff88]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(0,255,136,0.4)]">
      <path d="M12 3C7.03 3 3 6.58 3 11C3 13.14 4.02 15.08 5.71 16.5C5.46 17.82 4.7 19.38 3.32 20.35C3.07 20.53 3.19 20.93 3.5 20.95C6.12 21.1 8.28 19.8 9.5 18.84C10.3 19.11 11.14 19.25 12 19.25C16.97 19.25 21 15.67 21 11.25C21 6.83 16.97 3 12 3Z" fill="#0d1717" stroke="url(#souf_chat_grad)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 7.5V14.5M8.5 11H15.5" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="11" r="1.5" fill="#ffffff" />
      <defs>
        <linearGradient id="souf_chat_grad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00ff88" />
          <stop offset="0.5" stopColor="#00d4aa" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 2. Neural Brain / AI Reasoning Icon (Synapse Core)
export const SoufBrainIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#0ea5e9]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(14,165,233,0.4)]">
      <path d="M12 3V21M12 3C9.5 3 7 4.5 7 7.5C7 9.5 8 11 9.5 12C7.5 12.5 6 14 6 16.5C6 19.5 8.5 21 12 21M12 3C14.5 3 17 4.5 17 7.5C17 9.5 16 11 14.5 12C16.5 12.5 18 14 18 16.5C18 19.5 15.5 21 12 21" stroke="url(#souf_brain_grad)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="7" cy="7.5" r="1.5" fill="#00ff88" />
      <circle cx="17" cy="7.5" r="1.5" fill="#0ea5e9" />
      <circle cx="6" cy="16.5" r="1.5" fill="#00d4aa" />
      <circle cx="18" cy="16.5" r="1.5" fill="#a855f7" />
      <circle cx="12" cy="12" r="2" fill="#ffffff" />
      <defs>
        <linearGradient id="souf_brain_grad" x1="6" y1="3" x2="18" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0ea5e9" />
          <stop offset="0.5" stopColor="#00d4aa" />
          <stop offset="1" stopColor="#00ff88" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 3. Globe / Live Search Grounding Icon (Cyber Radar Grid)
export const SoufGlobeIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#00d4aa]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(0,212,170,0.4)]">
      <circle cx="12" cy="12" r="9" fill="#071212" stroke="url(#souf_globe_grad)" strokeWidth="1.8" />
      <ellipse cx="12" cy="12" rx="4" ry="9" stroke="#00ff88" strokeWidth="1.2" strokeDasharray="2 2" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="#00ff88" strokeWidth="1.2" />
      <line x1="4.5" y1="7.5" x2="19.5" y2="7.5" stroke="#0ea5e9" strokeWidth="1" opacity="0.7" />
      <line x1="4.5" y1="16.5" x2="19.5" y2="16.5" stroke="#0ea5e9" strokeWidth="1" opacity="0.7" />
      <circle cx="12" cy="12" r="1.8" fill="#ffffff" />
      <defs>
        <linearGradient id="souf_globe_grad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00d4aa" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 4. Cyber Shield Security Icon (Aegis Hexagon)
export const SoufShieldIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#00ff88]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(0,255,136,0.4)]">
      <path d="M12 3L20 6V11.5C20 16.5 16.5 20.2 12 21.5C7.5 20.2 4 16.5 4 11.5V6L12 3Z" fill="#0a1414" stroke="url(#souf_shield_grad)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 11.5L11 13.5L15 9.5" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="7" stroke="#00ff88" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4" />
      <defs>
        <linearGradient id="souf_shield_grad" x1="4" y1="3" x2="20" y2="21.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00ff88" />
          <stop offset="0.5" stopColor="#00d4aa" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 5. Code Processor Terminal Icon (Matrix Brackets)
export const SoufCodeIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#38bdf8]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(56,189,248,0.4)]">
      <rect x="3" y="4" width="18" height="16" rx="4" fill="#081521" stroke="url(#souf_code_grad)" strokeWidth="1.8" />
      <path d="M8 9L5.5 12L8 15" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 9L18.5 12L16 15" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="13" y1="8" x2="11" y2="16" stroke="#00ff88" strokeWidth="1.8" strokeLinecap="round" />
      <defs>
        <linearGradient id="souf_code_grad" x1="3" y1="4" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 6. Bot / Agent Visor Icon (Autonomous Sentinel)
export const SoufBotIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#a855f7]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]">
      <rect x="4" y="8" width="16" height="12" rx="4" fill="#12091f" stroke="url(#souf_bot_grad)" strokeWidth="1.8" />
      <rect x="7" y="11" width="10" height="4" rx="2" fill="url(#souf_bot_visor)" stroke="#a855f7" strokeWidth="0.8" />
      <circle cx="9.5" cy="13" r="1" fill="#ffffff" />
      <circle cx="14.5" cy="13" r="1" fill="#ffffff" />
      <line x1="12" y1="8" x2="12" y2="4" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="3" r="1.5" fill="#00ff88" />
      <path d="M7 20V22M17 20V22" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round" />
      <defs>
        <linearGradient id="souf_bot_grad" x1="4" y1="8" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c084fc" />
          <stop offset="1" stopColor="#7e22ce" />
        </linearGradient>
        <linearGradient id="souf_bot_visor" x1="7" y1="11" x2="17" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a855f7" />
          <stop offset="1" stopColor="#00ff88" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 7. Sparkles / Lightning Energy Icon (Quantum Energy Spark)
export const SoufSparklesIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#fbbf24]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]">
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="url(#souf_spark_grad)" stroke="#fde047" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="18" cy="6" r="1.5" fill="#00ff88" />
      <circle cx="6" cy="18" r="1" fill="#38bdf8" />
      <defs>
        <linearGradient id="souf_spark_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 8. History / Chrono Vault Icon (Time Matrix)
export const SoufHistoryIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#00d4aa]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(0,212,170,0.4)]">
      <path d="M3 12A9 9 0 1 0 5.64 5.64L3 3V9H9" stroke="url(#souf_hist_grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7V12L15.5 15.5" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1" fill="#ffffff" />
      <defs>
        <linearGradient id="souf_hist_grad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00ff88" />
          <stop offset="0.5" stopColor="#00d4aa" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 9. API Key Cyber Vault Icon (Security Node)
export const SoufKeyIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#f43f5e]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]">
      <circle cx="8" cy="12" r="5" fill="#14080c" stroke="url(#souf_key_grad)" strokeWidth="1.8" />
      <circle cx="8" cy="12" r="2" fill="#00ff88" />
      <path d="M13 12H21M18 12V15M21 12V15" stroke="url(#souf_key_grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="souf_key_grad" x1="3" y1="7" x2="21" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fb7185" />
          <stop offset="0.5" stopColor="#e11d48" />
          <stop offset="1" stopColor="#00ff88" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 10. Performance Telemetry Pulse Icon (Stats & Analytics)
export const SoufStatsIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#00ff88]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(0,255,136,0.4)]">
      <rect x="3" y="13" width="3.5" height="8" rx="1.5" fill="#00ff88" />
      <rect x="8.5" y="8" width="3.5" height="13" rx="1.5" fill="#00d4aa" />
      <rect x="14" y="3" width="3.5" height="18" rx="1.5" fill="#0ea5e9" />
      <path d="M2.5 10L8 6L13.5 11L21.5 3" stroke="#fde047" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21.5" cy="3" r="1.5" fill="#fde047" />
    </svg>
  </div>
);

// 11. Multi-Tool Arsenal Icon (SoufTools Suite)
export const SoufToolsSuiteIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#0ea5e9]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(14,165,233,0.4)]">
      <path d="M14.7 6.3A1 1 0 0 0 13 7V10H4A2 2 0 0 0 2 12V18A2 2 0 0 0 4 20H20A2 2 0 0 0 22 18V12A2 2 0 0 0 20 10H17V7A1 1 0 0 0 15.3 6.3L14.7 6.3Z" fill="#07131a" stroke="url(#souf_tools_grad)" strokeWidth="1.8" />
      <rect x="9" y="4" width="6" height="6" rx="1.5" fill="#0ea5e9" stroke="#ffffff" strokeWidth="0.8" />
      <circle cx="12" cy="15" r="2" fill="#00ff88" />
      <defs>
        <linearGradient id="souf_tools_grad" x1="2" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="0.5" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#00ff88" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 12. Settings / Engine Control Icon
export const SoufSettingsIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#00d4aa]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(0,212,170,0.4)]">
      <circle cx="12" cy="12" r="3" fill="#00ff88" stroke="#ffffff" strokeWidth="0.8" />
      <path d="M19.4 15A1.65 1.65 0 0 0 20 12A1.65 1.65 0 0 0 19.4 9L21 7.4L19.4 5.8L17.8 7.4A1.65 1.65 0 0 0 15 6.6V4.4H13V6.6A1.65 1.65 0 0 0 10.2 7.4L8.6 5.8L7 7.4L8.6 9A1.65 1.65 0 0 0 8 12A1.65 1.65 0 0 0 8.6 15L7 16.6L8.6 18.2L10.2 16.6A1.65 1.65 0 0 0 13 17.4V19.6H15V17.4A1.65 1.65 0 0 0 17.8 16.6L19.4 18.2L21 16.6L19.4 15Z" stroke="url(#souf_sett_grad)" strokeWidth="1.8" strokeLinejoin="round" fill="#0a1414" />
      <defs>
        <linearGradient id="souf_sett_grad" x1="7" y1="4.4" x2="21" y2="19.6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00d4aa" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 13. Admin Matrix / System Control Icon
export const SoufAdminIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-[#00ff88]/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(0,255,136,0.4)]">
      <path d="M12 2L3 7V12C3 17.5 6.8 22.5 12 24C17.2 22.5 21 17.5 21 12V7L12 2Z" fill="#081414" stroke="url(#souf_adm_grad)" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.5" fill="#00ff88" />
      <path d="M8 17C8 14.8 9.8 13 12 13C14.2 13 16 14.8 16 17" stroke="#0ea5e9" strokeWidth="1.8" strokeLinecap="round" />
      <defs>
        <linearGradient id="souf_adm_grad" x1="3" y1="2" x2="21" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00ff88" />
          <stop offset="0.5" stopColor="#00d4aa" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 14. Faceted Crystal Diamond Luxury Icon
export const SoufDiamondIcon: React.FC<BrandIconProps> = ({ size = 24, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1.5 rounded-full bg-amber-400/40 blur-md animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
      <path d="M6 3L18 3L22 9L12 22L2 9L6 3Z" fill="url(#souf_diam_body)" stroke="url(#souf_diam_border)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6 3L12 9L18 3" stroke="#fef08a" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12 9V22" stroke="#fef08a" strokeWidth="1.2" />
      <path d="M2 9H22" stroke="#fbbf24" strokeWidth="1.2" />
      <path d="M12 9L7 22M12 9L17 22" stroke="#00d4aa" strokeWidth="0.8" opacity="0.7" />
      <circle cx="12" cy="9" r="1.5" fill="#ffffff" className="animate-ping" />
      <defs>
        <linearGradient id="souf_diam_body" x1="2" y1="3" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e1b0c" />
          <stop offset="0.5" stopColor="#0d1f1f" />
          <stop offset="1" stopColor="#0a2a22" />
        </linearGradient>
        <linearGradient id="souf_diam_border" x1="2" y1="3" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#00d4aa" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 15. Imperial Gold Crown Luxury Icon
export const SoufCrownLuxuryIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-amber-400/30 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
      <path d="M3 18H21L20 9L15 13L12 5L9 13L4 9L3 18Z" fill="url(#souf_crown_body)" stroke="url(#souf_crown_border)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3 18H21V20C21 20.5 20.5 21 20 21H4C3.5 21 3 20.5 3 20V18Z" fill="#181508" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="12" cy="5" r="1.5" fill="#fef08a" />
      <circle cx="4" cy="9" r="1.2" fill="#fbbf24" />
      <circle cx="20" cy="9" r="1.2" fill="#fbbf24" />
      <circle cx="12" cy="19.5" r="1" fill="#00d4aa" />
      <defs>
        <linearGradient id="souf_crown_body" x1="3" y1="5" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#292005" />
          <stop offset="1" stopColor="#0a1212" />
        </linearGradient>
        <linearGradient id="souf_crown_border" x1="3" y1="5" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fef08a" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 16. Supersonic Rocket High-Tech Icon
export const SoufRocketLuxuryIcon: React.FC<BrandIconProps> = ({ size = 20, className = "", glow = false }) => (
  <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
    {glow && <div className="absolute -inset-1 rounded-full bg-amber-400/40 blur-sm animate-pulse" />}
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">
      <path d="M4.5 16.5C3 18 3 21 3 21C3 21 6 21 7.5 19.5C8.5 18.5 8.5 17 7.5 16C6.5 15 5.5 15.5 4.5 16.5Z" fill="#ef4444" stroke="#f97316" strokeWidth="1.2" />
      <path d="M14.5 4C14.5 4 19 4.5 20 5.5C21 6.5 21.5 11 21.5 11L17 15.5L10 8.5L14.5 4Z" fill="url(#souf_rocket_body)" stroke="url(#souf_rocket_stroke)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 8.5L7 11.5L8.5 14.5L10.5 14L11 16L14 17.5L17 14.5" fill="#0f1919" stroke="#00d4aa" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="16" cy="8" r="1.8" fill="#00d4aa" stroke="#ffffff" strokeWidth="0.8" />
      <path d="M6 18L4 20" stroke="#fef08a" strokeWidth="1.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="souf_rocket_body" x1="10" y1="4" x2="21.5" y2="15.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fef08a" />
          <stop offset="0.5" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#0d1b1b" />
        </linearGradient>
        <linearGradient id="souf_rocket_stroke" x1="10" y1="4" x2="21.5" y2="15.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#00d4aa" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// 17. Universal SoufBrandIcon Dynamic Component
export const SoufBrandIcon: React.FC<{
  name: string;
  size?: number;
  className?: string;
  glow?: boolean;
}> = ({ name, size = 20, className = "", glow = false }) => {
  const iconKey = name.toLowerCase().trim();

  switch (iconKey) {
    case "chat":
    case "new_chat":
    case "plus":
      return <SoufChatPlusIcon size={size} className={className} glow={glow} />;
    case "brain":
    case "reasoning":
    case "intelligence":
    case "memory":
      return <SoufBrainIcon size={size} className={className} glow={glow} />;
    case "globe":
    case "search":
    case "web":
    case "grounding":
      return <SoufGlobeIcon size={size} className={className} glow={glow} />;
    case "shield":
    case "security":
    case "privacy":
    case "lock":
      return <SoufShieldIcon size={size} className={className} glow={glow} />;
    case "code":
    case "terminal":
    case "developer":
      return <SoufCodeIcon size={size} className={className} glow={glow} />;
    case "bot":
    case "agent":
    case "sentinel":
      return <SoufBotIcon size={size} className={className} glow={glow} />;
    case "sparkles":
    case "zap":
    case "energy":
    case "spark":
      return <SoufSparklesIcon size={size} className={className} glow={glow} />;
    case "history":
    case "chrono":
    case "time":
      return <SoufHistoryIcon size={size} className={className} glow={glow} />;
    case "key":
    case "vault":
    case "apikey":
      return <SoufKeyIcon size={size} className={className} glow={glow} />;
    case "stats":
    case "analytics":
    case "telemetry":
      return <SoufStatsIcon size={size} className={className} glow={glow} />;
    case "tools":
    case "suite":
    case "toolbox":
      return <SoufToolsSuiteIcon size={size} className={className} glow={glow} />;
    case "settings":
    case "gear":
    case "config":
      return <SoufSettingsIcon size={size} className={className} glow={glow} />;
    case "admin":
    case "control":
    case "system":
      return <SoufAdminIcon size={size} className={className} glow={glow} />;
    default:
      return <SoufSparklesIcon size={size} className={className} glow={glow} />;
  }
};
