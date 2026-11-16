"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, Globe, Copy, Check, Info, Sparkles, X, ShieldCheck } from "lucide-react";
import { copyToClipboard } from "@/lib/utils";

interface TimeClockWidgetProps {
  data: {
    timezone: string;
    cityName: string;
    cityEn?: string;
    countryEn?: string;
    flagEmoji?: string;
    localTime: string;       // "01:32:45"
    localTimeShort: string;  // "01:32"
    localDate: string;       // "2026-08-10"
    year: number;
    monthShortAr: string;
    monthShortEn: string;
    dayOfMonth: number;
    dayOfWeekAr: string;
    dayOfWeekEn: string;
    formattedDateAr: string;
    formattedDateEn: string;
    utcOffset: string;
    isDST: boolean;
  };
  isRtl?: boolean;
}

export const TimeClockWidget: React.FC<TimeClockWidgetProps> = ({ data, isRtl = true }) => {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Time calculation state
  const [nowDate, setNowDate] = useState<Date | null>(null);

  // Parse initial local time into seconds or base timestamp
  useEffect(() => {
    // Determine target timezone offset from data.utcOffset or data.timezone
    let tz = data.timezone || "UTC";

    const updateTime = () => {
      try {
        const now = new Date();
        setNowDate(now);
      } catch (e) {
        setNowDate(new Date());
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [data.timezone]);

  // Compute exact local hours, minutes, seconds for target timezone
  let hours = 12;
  let minutes = 0;
  let seconds = 0;
  let timeDigital = data.localTime || "12:00:00";
  let dateFormattedAr = data.formattedDateAr || "";
  let dateFormattedEn = data.formattedDateEn || "";

  if (nowDate) {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: data.timezone,
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false,
      });

      const parts = formatter.formatToParts(nowDate);
      for (const p of parts) {
        if (p.type === "hour") hours = parseInt(p.value, 10) % 12;
        if (p.type === "minute") minutes = parseInt(p.value, 10);
        if (p.type === "second") seconds = parseInt(p.value, 10);
      }

      // Format digital live string
      const digFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: data.timezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      timeDigital = digFormatter.format(nowDate);

      // Format live date strings
      const arFormatter = new Intl.DateTimeFormat("ar-MA", {
        timeZone: data.timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      dateFormattedAr = arFormatter.format(nowDate);

      const enFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: data.timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      dateFormattedEn = enFormatter.format(nowDate);
    } catch (e) {
      // Fallback parse from data.localTime
      if (data.localTime) {
        const tParts = data.localTime.split(":");
        if (tParts.length >= 2) {
          hours = parseInt(tParts[0], 10) % 12;
          minutes = parseInt(tParts[1], 10);
          seconds = tParts[2] ? parseInt(tParts[2], 10) : 0;
        }
      }
    }
  }

  // Calculate angles for clock hands
  const secondAngle = seconds * 6; // 360 / 60
  const minuteAngle = minutes * 6 + seconds * 0.1; // 360 / 60 + second drift
  const hourAngle = hours * 30 + minutes * 0.5; // 360 / 12 + minute drift

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const copyText = `📍 ${data.cityName} (${data.timezone})
⏰ ${timeDigital} | ${data.utcOffset}
📅 ${dateFormattedAr}`;
    await copyToClipboard(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3.5 w-full max-w-xl mx-auto select-none" dir={isRtl ? "rtl" : "ltr"}>
      {/* Luxury Glassmorphic Outer Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        onClick={() => setShowModal(true)}
        className="relative group cursor-pointer overflow-hidden rounded-3xl border border-[#00d4aa]/30 bg-gradient-to-b from-[#0c1818]/90 via-[#081212]/95 to-[#040909] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-[#00d4aa]/60 hover:shadow-[0_0_35px_rgba(0,212,170,0.22)] transition-all duration-300"
      >
        {/* Subtle Ambient Glowing Background Orbs */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-[#00d4aa]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[#00d4aa]/20 transition-all duration-500" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-[#00ff88]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[#00ff88]/15 transition-all duration-500" />

        {/* Top Header Row: Flag + City Name + Live Indicator */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#1e3232]/80 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              {data.flagEmoji || "🌍"}
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#e8f5f5] flex items-center gap-2">
                <span>{data.cityName}</span>
                {data.cityEn && (
                  <span className="text-[11px] font-normal text-[#88b0b0] font-mono">
                    ({data.cityEn})
                  </span>
                )}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-[#00d4aa] font-mono flex items-center gap-1.5 mt-0.5">
                <Globe className="w-3 h-3 text-[#00d4aa]" />
                <span>{data.timezone}</span>
              </p>
            </div>
          </div>

          {/* Live Status Indicator */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/30 text-[#00ff88] text-[10px] sm:text-[11px] font-semibold font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff88] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff88]"></span>
            </span>
            <span>LIVE</span>
          </div>
        </div>

        {/* Main Content Area: Analog Clock + Details Side Panel */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
          {/* 1. LUXURY ANALOG CLOCK */}
          <div className="relative shrink-0 flex items-center justify-center">
            {/* Outer Bezel Ring with metallic gradient & shadow */}
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full border-2 border-[#00d4aa]/40 bg-gradient-to-b from-[#102222] via-[#081313] to-[#030707] shadow-[inset_0_2px_10px_rgba(255,255,255,0.08),0_10px_30px_rgba(0,0,0,0.8),0_0_25px_rgba(0,212,170,0.15)] flex items-center justify-center">
              
              {/* Outer Minute Tick Marks (60 subtle tick lines) */}
              {Array.from({ length: 60 }).map((_, i) => {
                const isMajor = i % 5 === 0;
                return (
                  <div
                    key={`tick-${i}`}
                    className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 flex flex-col justify-between items-center pointer-events-none"
                    style={{ transform: `rotate(${i * 6}deg)` }}
                  >
                    <div
                      className={`w-0.5 ${
                        isMajor
                          ? "h-2.5 sm:h-3 bg-[#00d4aa] shadow-[0_0_4px_#00d4aa]"
                          : "h-1 bg-[#1e3a3a]"
                      }`}
                    />
                    <div
                      className={`w-0.5 ${
                        isMajor ? "h-2.5 sm:h-3 bg-[#00d4aa]/80" : "h-1 bg-[#1e3a3a]"
                      }`}
                    />
                  </div>
                );
              })}

              {/* Hour Numbers / Indicators at 12, 3, 6, 9 */}
              <div className="absolute inset-3 rounded-full pointer-events-none">
                <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-bold font-mono text-[#00d4aa]">
                  12
                </span>
                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] sm:text-xs font-bold font-mono text-[#00d4aa]">
                  3
                </span>
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-bold font-mono text-[#00d4aa]">
                  6
                </span>
                <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] sm:text-xs font-bold font-mono text-[#00d4aa]">
                  9
                </span>
              </div>

              {/* 2. DATE WINDOW (Luxury Mechanical Watch Feature) */}
              <div className="absolute right-9 sm:right-11 top-1/2 -translate-y-1/2 z-10 px-2 py-0.5 rounded border border-[#00d4aa]/40 bg-[#040a0a] shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)] text-[9px] sm:text-[10px] font-bold font-mono text-[#e8f5f5] flex items-center gap-1">
                <span className="text-[#00ff88]">
                  {data.dayOfWeekEn || "MON"}
                </span>
                <span className="text-[#4a7070]">•</span>
                <span>
                  {data.dayOfMonth || "10"} {data.monthShortEn || "AUG"}
                </span>
              </div>

              {/* Brand Logo / Watermark inside dial */}
              <div className="absolute top-11 sm:top-14 left-1/2 -translate-x-1/2 text-center pointer-events-none z-10">
                <span className="text-[9px] sm:text-[10px] font-bold tracking-widest text-[#00d4aa]/80 uppercase font-mono">
                  SOUFAI
                </span>
                <p className="text-[7px] sm:text-[8px] font-mono text-[#4a7070] tracking-tighter">
                  CHRONOMETER
                </p>
              </div>

              {/* Year Label inside dial bottom */}
              <div className="absolute bottom-11 sm:bottom-14 left-1/2 -translate-x-1/2 text-center pointer-events-none z-10">
                <span className="text-[9px] sm:text-[10px] font-mono text-[#88b0b0]">
                  {data.year || 2026}
                </span>
              </div>

              {/* HOUR HAND */}
              <div
                className="absolute top-1/2 left-1/2 w-1 sm:w-1.5 h-12 sm:h-16 bg-gradient-to-t from-[#00d4aa] to-[#e8f5f5] rounded-full origin-bottom shadow-[0_0_8px_rgba(0,0,0,0.8)] z-20 transition-transform duration-300"
                style={{
                  transform: `translate(-50%, -100%) rotate(${hourAngle}deg)`,
                }}
              />

              {/* MINUTE HAND */}
              <div
                className="absolute top-1/2 left-1/2 w-0.5 sm:w-1 h-16 sm:h-20 bg-gradient-to-t from-[#00ff88] to-[#ffffff] rounded-full origin-bottom shadow-[0_0_8px_rgba(0,0,0,0.8)] z-20 transition-transform duration-300"
                style={{
                  transform: `translate(-50%, -100%) rotate(${minuteAngle}deg)`,
                }}
              />

              {/* SECOND HAND (Continuous/Live Ticking) */}
              <div
                className="absolute top-1/2 left-1/2 w-0.5 h-20 sm:h-24 bg-[#00ff88] rounded-full origin-bottom shadow-[0_0_10px_#00ff88] z-30 transition-transform duration-200"
                style={{
                  transform: `translate(-50%, -100%) rotate(${secondAngle}deg)`,
                }}
              >
                {/* Second hand counter-weight tail */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-4 bg-[#00ff88] translate-y-3 rounded-full" />
              </div>

              {/* CENTER CAP HUB */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#00ff88] border-2 border-[#040909] shadow-[0_0_10px_#00ff88] z-40 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-[#ffffff]" />
              </div>
            </div>
          </div>

          {/* 3. DETAILS SIDE PANEL (Digital Clock + UTC + Date) */}
          <div className="flex-1 w-full flex flex-col justify-center space-y-3">
            {/* Digital Live Ticker Display */}
            <div className="p-3.5 rounded-2xl bg-[#061010] border border-[#1e3232] shadow-inner text-center sm:text-start">
              <div className="text-[10px] text-[#4a7070] font-mono font-medium mb-1 flex items-center gap-1.5 justify-center sm:justify-start">
                <Clock className="w-3 h-3 text-[#00d4aa]" />
                <span>{isRtl ? "الوقت الرقمي المباشر:" : "Digital Live Time:"}</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#00ff88] tracking-wider drop-shadow-[0_0_12px_rgba(0,255,136,0.3)]">
                {timeDigital}
              </div>
            </div>

            {/* Date Details */}
            <div className="space-y-1.5 text-xs text-center sm:text-start">
              <p className="text-[#e8f5f5] font-medium leading-relaxed">
                📅 {dateFormattedAr}
              </p>
              {dateFormattedEn && (
                <p className="text-[11px] text-[#88b0b0] font-mono">
                  {dateFormattedEn}
                </p>
              )}
            </div>

            {/* UTC Offset & DST Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
              <div className="px-2.5 py-1 rounded-xl bg-[#0d1c1c] border border-[#00d4aa]/30 text-[#00d4aa] text-[11px] font-mono font-bold">
                UTC {data.utcOffset}
              </div>

              {data.isDST && (
                <div className="px-2.5 py-1 rounded-xl bg-[#eab308]/10 border border-[#eab308]/30 text-[#eab308] text-[11px] font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>{isRtl ? "التوقيت الصيفي (DST)" : "Daylight Saving"}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-xl bg-[#112020] hover:bg-[#182b2b] border border-[#1e3232] text-[#88b0b0] hover:text-[#00d4aa] text-[11px] font-medium transition-colors flex items-center gap-1 ms-auto"
                title={isRtl ? "نسخ البيانات" : "Copy details"}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-[#00ff88]" />
                    <span className="text-[#00ff88]">{isRtl ? "تم النسخ" : "Copied"}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{isRtl ? "نسخ" : "Copy"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Hint */}
        <div className="mt-3 pt-2.5 border-t border-[#1e3232]/60 flex items-center justify-between text-[10px] text-[#4a7070]">
          <span className="flex items-center gap-1 text-[#88b0b0]">
            <Info className="w-3 h-3 text-[#00d4aa]" />
            {isRtl ? "اضغط على البطاقة لفتح التفاصيل الكاملة" : "Click card for full details"}
          </span>
          <span className="font-mono text-[#00d4aa]/70">SoufTools • Time Engine</span>
        </div>
      </motion.div>

      {/* 4. EXPANDABLE DETAILS MODAL / DIALOG */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg rounded-3xl border border-[#00d4aa]/40 bg-gradient-to-b from-[#0c1818] via-[#081212] to-[#040808] p-6 shadow-[0_0_50px_rgba(0,212,170,0.2)] text-[#e8f5f5]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Close Button */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 left-4 p-2 rounded-xl bg-[#112020] hover:bg-[#182a2a] text-[#88b0b0] hover:text-[#00d4aa] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#1e3232]">
                <span className="text-3xl">{data.flagEmoji || "🌍"}</span>
                <div>
                  <h3 className="text-lg font-bold text-[#e8f5f5]">
                    {data.cityName}
                  </h3>
                  <p className="text-xs text-[#00d4aa] font-mono">{data.timezone}</p>
                </div>
              </div>

              {/* Modal Content Grid */}
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#061010] border border-[#1e3232] text-center">
                  <span className="text-xs text-[#4a7070] font-mono block mb-1">
                    {isRtl ? "الوقت الحقيقي والدقيق الآن" : "Live Exact Time"}
                  </span>
                  <div className="text-3xl sm:text-4xl font-extrabold font-mono text-[#00ff88] tracking-widest drop-shadow-[0_0_15px_rgba(0,255,136,0.4)]">
                    {timeDigital}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#0d1c1c] border border-[#1e3232]">
                    <span className="text-[#4a7070] text-[10px] block font-mono mb-0.5">
                      {isRtl ? "التاريخ الهجري/الميلادي (عربي)" : "Date (Arabic)"}
                    </span>
                    <span className="font-semibold text-[#e8f5f5]">{dateFormattedAr}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0d1c1c] border border-[#1e3232]">
                    <span className="text-[#4a7070] text-[10px] block font-mono mb-0.5">
                      {isRtl ? "التاريخ بالإنجليزية" : "Date (English)"}
                    </span>
                    <span className="font-semibold text-[#e8f5f5] font-mono">
                      {dateFormattedEn}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0d1c1c] border border-[#1e3232]">
                    <span className="text-[#4a7070] text-[10px] block font-mono mb-0.5">
                      {isRtl ? "فارق التوقيت Universal Time" : "UTC Offset"}
                    </span>
                    <span className="font-bold text-[#00d4aa] font-mono">
                      UTC {data.utcOffset}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0d1c1c] border border-[#1e3232]">
                    <span className="text-[#4a7070] text-[10px] block font-mono mb-0.5">
                      {isRtl ? "التوقيت الصيفي (DST)" : "DST Status"}
                    </span>
                    <span
                      className={`font-bold ${
                        data.isDST ? "text-[#eab308]" : "text-[#88b0b0]"
                      }`}
                    >
                      {data.isDST
                        ? isRtl
                          ? "مُفعل حالياً (True)"
                          : "Active (True)"
                        : isRtl
                        ? "غير مُفعل (False)"
                        : "Inactive (False)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="mt-6 pt-4 border-t border-[#1e3232] flex items-center justify-between">
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-xl bg-[#00d4aa]/15 hover:bg-[#00d4aa]/25 border border-[#00d4aa]/40 text-[#00d4aa] text-xs font-semibold transition-colors flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4 text-[#00ff88]" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? (isRtl ? "تم النسخ!" : "Copied!") : (isRtl ? "نسخ معلومات التوقيت" : "Copy Time Info")}</span>
                </button>

                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#112020] hover:bg-[#182a2a] text-[#e8f5f5] text-xs font-medium transition-colors"
                >
                  {isRtl ? "إغلاق" : "Close"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
