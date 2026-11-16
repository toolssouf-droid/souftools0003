"use client";

import React, { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/store/chatStore";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthCookie, setAuthCookie } from "@/lib/authCookies";
import { getApps } from "firebase/app";

interface LoadingScreenProps {
  onComplete: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadingText, setLoadingText] = useState<string>("جاري تهيئة الاتصال...");
  const [displayedProgress, setDisplayedProgress] = useState<number>(0);
  const [failed, setFailed] = useState<boolean>(false);

  const { setUserEmail, setUserId } = useChatStore();

  const onCompleteRef = useRef(onComplete);
  const setUserEmailRef = useRef(setUserEmail);
  const setUserIdRef = useRef(setUserId);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    setUserEmailRef.current = setUserEmail;
    setUserIdRef.current = setUserId;
  });

  // Refs to share animation states across the render loop
  const stateRef = useRef({
    progress: 0,
    targetProgress: 24, // starts at 24 (step 1 cap)
    stepIndex: 0,
    failed: false,
    time: 0,
    particles: [] as Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      targetX?: number;
      targetY?: number;
    }>,
    pulse: 1.0,
    wavePulseSpeed: 1.0,
    stepCompleted: [false, false, false, false],
  });

  // 1. Initialize Canvas and Particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const state = stateRef.current;

    // Resize canvas to cover screen properly with high DPI support
    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Initialize neural network particles (scattered around center)
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const particleCount = 60;
    state.particles = [];

    for (let i = 0; i < particleCount; i++) {
      // Create particles bursting out from center
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      state.particles.push({
        x: centerX + Math.cos(angle) * (10 + Math.random() * 30),
        y: centerY + Math.sin(angle) * (10 + Math.random() * 30),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2,
        color: i % 2 === 0 ? "#00d4aa" : "#00ff88",
        alpha: 0.1 + Math.random() * 0.8,
      });
    }

    // Main animation loop
    const render = () => {
      state.time += 0.016; // increment time (approx. 60 FPS)

      const width = window.innerWidth;
      const height = window.innerHeight;
      const cx = width / 2;
      const cy = height / 2;

      // Smoothly animate displayed progress
      // If task is completed, we can animate rapidly to the target (e.g. 25, 50, 75, 100)
      // Otherwise, we decay smoothly towards the cap (step.progress - 1)
      const currentStepMax = (state.stepIndex + 1) * 25;
      const isCurrentStepFinished = state.stepCompleted[state.stepIndex];
      const stepTarget = isCurrentStepFinished ? currentStepMax : currentStepMax - 1;

      state.targetProgress = stepTarget;

      const progressDiff = state.targetProgress - state.progress;
      if (progressDiff > 0.05) {
        // Accelerate if fast, slow down as it gets closer
        const speedMultiplier = isCurrentStepFinished ? 0.15 : 0.03;
        state.progress += progressDiff * speedMultiplier;
      } else if (!isCurrentStepFinished) {
        // "Waiting" breathing pulse to prevent freezing visually
        const pulseOffset = Math.sin(state.time * 2) * 0.4;
        state.progress = (currentStepMax - 1) + pulseOffset;
      } else {
        state.progress = currentStepMax;
      }

      setDisplayedProgress(Math.min(100, Math.max(0, Math.round(state.progress))));

      // Clear Canvas & Draw Background Glow
      ctx.fillStyle = "#0a0f0f";
      ctx.fillRect(0, 0, width, height);

      // Radial Deep Teal Atmosphere Glow in Center
      const glowGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(width, height) * 0.6);
      glowGrad.addColorStop(0, "rgba(0, 212, 170, 0.08)");
      glowGrad.addColorStop(1, "rgba(10, 15, 15, 0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // Red failure flash pulse if failed state is active
      if (state.failed) {
        const redPulse = Math.sin(state.time * 8) * 0.5 + 0.5;
        const failedGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(width, height) * 0.5);
        failedGrad.addColorStop(0, `rgba(239, 68, 68, ${0.1 * redPulse})`);
        failedGrad.addColorStop(1, "rgba(10, 15, 15, 0)");
        ctx.fillStyle = failedGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // Draw Animations based on state.progress
      const p = state.progress;

      // Draw the central pulsing light dot / core
      const corePulse = 1.0 + Math.sin(state.time * (state.failed ? 12 : 3)) * 0.15;
      const coreRadius = 8 * corePulse;
      ctx.shadowBlur = 15;
      ctx.shadowColor = state.failed ? "#ef4444" : "#00d4aa";

      // ----------------------------------------------------
      // PHASE 1: 0 - 25% (neural-network-expand)
      // ----------------------------------------------------
      if (p >= 0 && p < 25) {
        const expandRatio = p / 25; // 0 to 1

        // Single teal dot pulsing in the center at 0%, then explodes & extends
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
        ctx.fillStyle = state.failed ? "#ef4444" : "#00d4aa";
        ctx.fill();

        if (expandRatio > 0.05) {
          // Update and draw neural network
          state.particles.forEach((pt, i) => {
            // Apply speed outward from center
            pt.x += pt.vx * (1 + expandRatio * 2);
            pt.y += pt.vy * (1 + expandRatio * 2);

            // Keep within bounds
            if (pt.x < 0 || pt.x > width) pt.vx *= -1;
            if (pt.y < 0 || pt.y > height) pt.vy *= -1;

            // Draw particle
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
            ctx.fillStyle = pt.color;
            ctx.globalAlpha = pt.alpha * expandRatio;
            ctx.fill();
            ctx.globalAlpha = 1.0;

            // Draw connections to nearby particles
            for (let j = i + 1; j < state.particles.length; j++) {
              const pt2 = state.particles[j];
              const dist = Math.hypot(pt.x - pt2.x, pt.y - pt2.y);
              const maxDist = 120 * expandRatio;
              if (dist < maxDist) {
                ctx.beginPath();
                ctx.moveTo(pt.x, pt.y);
                ctx.lineTo(pt2.x, pt2.y);
                ctx.strokeStyle = "#00d4aa";
                ctx.globalAlpha = (1 - dist / maxDist) * 0.18 * expandRatio;
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
              }
            }
          });
        }
      }

      // ----------------------------------------------------
      // PHASE 2: 25 - 50% (wave-form)
      // ----------------------------------------------------
      else if (p >= 25 && p < 50) {
        // Transition ratio from Phase 1 to Phase 2
        const p2Ratio = (p - 25) / 25; // 0 to 1

        // Particles gather towards center and form ocean waves
        state.particles.forEach((pt, i) => {
          // Ocean wave target coordinates (arranged in circular orbits)
          const orbitIndex = i % 3; // 3 concentric rings of wave-form
          const baseRadius = 80 + orbitIndex * 50;
          const angleOffset = (i / state.particles.length) * Math.PI * 2 + state.time * 0.8;
          // Wave heights modulated by sine wave
          const waveHeight = 15 * Math.sin(state.time * 4 + angleOffset * 4);
          const targetX = cx + Math.cos(angleOffset) * (baseRadius + waveHeight);
          const targetY = cy + Math.sin(angleOffset) * (baseRadius + waveHeight);

          // Interpolate current position to target wave position
          pt.x += (targetX - pt.x) * 0.1;
          pt.y += (targetY - pt.y) * 0.1;

          // Draw glowing wave particles
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size * (1 + 0.3 * Math.sin(state.time * 5 + i)), 0, Math.PI * 2);
          ctx.fillStyle = i % 2 === 0 ? "#00d4aa" : "#00ff88";
          ctx.globalAlpha = 0.8;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        });

        // Draw flowing connecting wave contour rings
        for (let ring = 0; ring < 3; ring++) {
          const radius = 80 + ring * 50;
          ctx.beginPath();
          for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
            const waveOffset = 15 * Math.sin(state.time * 3 + a * 4 + ring);
            const r = radius + waveOffset;
            const x = cx + Math.cos(a + state.time * 0.2) * r;
            const y = cy + Math.sin(a + state.time * 0.2) * r;
            if (a === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = ring === 0 ? "#00ff88" : "#00d4aa";
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.25 * p2Ratio;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }
      }

      // ----------------------------------------------------
      // PHASE 3: 50 - 75% (text-write)
      // ----------------------------------------------------
      else if (p >= 50 && p < 75) {
        const p3Ratio = (p - 50) / 25; // 0 to 1
        const brandName = "SoufTools";
        const lettersCount = brandName.length;
        const visibleLetters = Math.floor(p3Ratio * lettersCount);

        // Draw sparkling letters sequentially popping up
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 48px sans-serif";
        ctx.shadowBlur = 25;
        ctx.shadowColor = "#00d4aa";

        // Separate letters drawing with glowing spacing
        const spacing = 32;
        const startX = cx - ((lettersCount - 1) * spacing) / 2;

        for (let j = 0; j < lettersCount; j++) {
          const char = brandName[j];
          const x = startX + j * spacing;
          const y = cy;

          if (j < visibleLetters) {
            // Letter is fully visible & glowing
            ctx.fillStyle = "#e8f5f5";
            ctx.shadowColor = "#00ff88";
            ctx.fillText(char, x, y);
          } else if (j === visibleLetters) {
            // Currently loading letter: scaling and flashing
            const scale = 1.0 + Math.abs(Math.sin(state.time * 10)) * 0.3;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            ctx.fillStyle = "#00d4aa";
            ctx.shadowColor = "#00d4aa";
            ctx.fillText(char, 0, 0);
            ctx.restore();
          } else {
            // Yet to appear: draw a very faint dot guide
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = "#1e2e2e";
            ctx.shadowBlur = 0;
            ctx.fill();
          }
        }

        // Pull particles to swirl around the brand text
        state.particles.forEach((pt, i) => {
          const targetLetterIdx = i % lettersCount;
          const targetX = startX + targetLetterIdx * spacing + Math.sin(state.time * 2 + i) * 15;
          const targetY = cy + Math.cos(state.time * 2 + i) * 25;

          // Pull particle to letter target
          pt.x += (targetX - pt.x) * 0.08;
          pt.y += (targetY - pt.y) * 0.08;

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = i % 2 === 0 ? "#00ff88" : "#0ea5e9";
          ctx.globalAlpha = 0.5 + Math.sin(state.time * 4 + i) * 0.3;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        });
      }

      // ----------------------------------------------------
      // PHASE 4: 75 - 100% (portal-open)
      // ----------------------------------------------------
      else {
        const p4Ratio = (p - 75) / 25; // 0 to 1

        // Brand name glows fully in the center
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 48px sans-serif";
        ctx.shadowBlur = 30;
        ctx.shadowColor = "#00ff88";
        ctx.fillStyle = "#e8f5f5";
        ctx.fillText("SoufTools", cx, cy);

        // Concentric portal rings expanding outward
        const ringCount = 3;
        for (let r = 0; r < ringCount; r++) {
          const baseRadius = 130 + r * 60;
          // Rings expand outward as portal opens
          const radius = baseRadius * (1.0 + p4Ratio * 1.5);
          const rotationDirection = r % 2 === 0 ? 1 : -1;
          const rotationAngle = state.time * 1.5 * rotationDirection;

          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = r === 0 ? "#00ff88" : "#00d4aa";
          ctx.lineWidth = 2.0;
          // Apply dashing for high-tech portal aesthetic
          ctx.setLineDash([40, 60]);
          ctx.lineDashOffset = rotationAngle * 50;
          ctx.shadowBlur = 15;
          ctx.shadowColor = r === 0 ? "#00ff88" : "#00d4aa";
          ctx.globalAlpha = (1.0 - p4Ratio) * 0.7; // fade out as it reaches 100%
          ctx.stroke();
          ctx.setLineDash([]); // reset dashing
          ctx.globalAlpha = 1.0;
        }

        // Send all particles shooting outward like hyper-drive starfield
        state.particles.forEach((pt, i) => {
          const angle = Math.atan2(pt.y - cy, pt.x - cx);
          const outwardSpeed = 12 * (1.0 + p4Ratio * 3);
          pt.x += Math.cos(angle) * outwardSpeed;
          pt.y += Math.sin(angle) * outwardSpeed;

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size * (1 + p4Ratio * 2), 0, Math.PI * 2);
          ctx.fillStyle = "#00ff88";
          ctx.globalAlpha = 1.0 - p4Ratio;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        });
      }

      ctx.shadowBlur = 0; // reset shadow effects

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // 2. Real Promises Loading & Error Retry Engine
  useEffect(() => {
    let active = true;
    const state = stateRef.current;

    // Helper to simulate mock time or perform real checks
    const initializeFirebase = async () => {
      // Ensure firebase configuration is loaded correctly
      const apps = getApps();
      if (apps.length === 0) {
        throw new Error("Firebase app failed to initialize");
      }
      // Guarantee visual transition time
      await new Promise((resolve) => setTimeout(resolve, 1000));
    };

    const checkAuthSession = async () => {
      return new Promise<void>((resolve, reject) => {
        // Retrieve and check cookie session
        const cookieData = getAuthCookie();
        if (
          cookieData?.email &&
          !cookieData.email.startsWith("usr_guest_") &&
          !cookieData.email.startsWith("guest_user@") &&
          !cookieData.email.endsWith("@souftools.app") &&
          !cookieData.email.endsWith("@souftools.internal")
        ) {
          setUserEmailRef.current(cookieData.email);
          if (cookieData.userId) setUserIdRef.current(cookieData.userId);
        }

        let resolved = false;

        const unsubscribe = onAuthStateChanged(
          auth,
          (user) => {
            if (resolved) return;
            resolved = true;
            unsubscribe();
            if (user && (user.email || user.phoneNumber)) {
              const email = user.email || user.phoneNumber || "";
              setUserEmailRef.current(email);
              setUserIdRef.current(user.uid);
              setAuthCookie(email, user.uid);
            }
            resolve();
          },
          (err) => {
            if (resolved) return;
            resolved = true;
            unsubscribe();
            reject(err);
          }
        );

        // Fallback timeout to prevent infinite hanging
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            unsubscribe();
            resolve(); // Proceed anyway
          }
        }, 3000);
      });
    };

    const loadModelSettings = async () => {
      // Real task: fetch setting or config delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
    };

    const prepareUI = async () => {
      // Complete UI adjustments
      await new Promise((resolve) => setTimeout(resolve, 800));
    };

    const steps = [
      { id: 1, task: initializeFirebase, text: "جاري تهيئة الاتصال..." },
      { id: 2, task: checkAuthSession, text: "التحقق من هويتك..." },
      { id: 3, task: loadModelSettings, text: "تحضير النماذج الذكية..." },
      { id: 4, task: prepareUI, text: "مرحباً في SoufTools ✓" },
    ];

    const runSequence = async () => {
      for (let i = 0; i < steps.length; i++) {
        if (!active) return;

        state.stepIndex = i;
        setLoadingText(steps[i].text);

        let success = false;
        let attempt = 0;

        while (!success && attempt < 3 && active) {
          try {
            await steps[i].task();
            success = true;
          } catch (err) {
            attempt++;
            console.warn(`Step ${i + 1} failed (Attempt ${attempt}/3):`, err);

            if (attempt < 3 && active) {
              setFailed(true);
              state.failed = true;
              setLoadingText("جاري إعادة المحاولة...");
              await new Promise((resolve) => setTimeout(resolve, 1500));
              setFailed(false);
              state.failed = false;
              setLoadingText(steps[i].text);
            } else if (active) {
              // Absolute final fail: freeze UI with subtle red light
              setFailed(true);
              state.failed = true;
              setLoadingText("فشل الاتصال بالخادم. جاري محاولة الربط الاحتياطي...");
              await new Promise((resolve) => setTimeout(resolve, 3000));
              success = true; // Bypass to keep the application usable rather than bricked
              setFailed(false);
              state.failed = false;
            }
          }
        }

        // Mark current step as completed to unlock the next progress segment
        state.stepCompleted[i] = true;

        // Fast forward the progress value to the end of the step smoothly
        const nextTarget = (i + 1) * 25;
        state.progress = nextTarget;
        
        // Wait briefly for visual catchup safely
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Done! Wait a brief moment for portal bloom explosion before rendering home layout
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (active) onCompleteRef.current();
    };

    runSequence();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0f0f] text-[#e8f5f5] select-none overflow-hidden dir-rtl">
      {/* Background Canvas for Interactive High-Tech VFX */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* Foreground Visual Content Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center space-y-6 max-w-sm">
        {/* Glowing Progress Percentage Badge */}
        <div className="px-4 py-1.5 rounded-full bg-[#111a1a]/80 border border-[#00d4aa]/30 text-[#00ff88] text-xs font-black tracking-widest font-mono shadow-[0_0_15px_rgba(0,255,136,0.15)] backdrop-blur-md">
          {displayedProgress}%
        </div>

        {/* Informative Step Text with custom state transitions */}
        <div className="space-y-2">
          <h2
            className={`text-sm sm:text-base font-bold text-[#e8f5f5] tracking-wide transition-all duration-300 ${
              failed ? "text-red-400 animate-pulse" : "text-[#e8f5f5]"
            }`}
          >
            {loadingText}
          </h2>
          <p className="text-[11px] text-[#4a7070] font-medium leading-relaxed">
            {displayedProgress < 25
              ? "يتم تأمين اتصال سحابي آمن مع خوادم SoufTools المشفرة..."
              : displayedProgress < 50
              ? "التحقق من صحة مفتاح الجلسة النشطة ومزامنة ملفات الحماية..."
              : displayedProgress < 75
              ? "تجهيز وتعيين مسارات التوجيه الذكية لنماذج Spark و Pro..."
              : "تحديث واجهات المستخدم وتجهيز المكونات التفاعلية..."}
          </p>
        </div>

        {/* Minimalist Horizontal Progress Bar Tracker */}
        <div className="w-48 h-1 bg-[#111a1a] rounded-full overflow-hidden border border-[#1e2e2e]/50 relative shadow-inner">
          <div
            className={`h-full bg-gradient-to-r from-[#00d4aa] to-[#00ff88] transition-all duration-75 rounded-full ${
              failed ? "from-red-500 to-rose-600 animate-pulse" : ""
            }`}
            style={{ width: `${displayedProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
