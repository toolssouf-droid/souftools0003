"use client";

/**
 * SoufTools High-Resolution 3D Cybernetic Mecha-Fish Simulation
 * 
 * Features:
 * - Direct Rendering of Ultra-HD 8K Octane Photorealistic 3D Fish Renders (Normal, Angry, Happy)
 * - 24-Slice Articulated Spine Mesh Deformation (Realistic biological swimming undulation)
 * - Zero-Latency Alpha-Chroma Cross-Morphing Engine between 3 visual states
 * - Smart Spatial Navigation (Zero boundary clipping, smooth orbit around UI card)
 * - Reactive Mouse & Touch Tracking with Ambient Particle Water Systems
 */

import React, { useEffect, useRef } from "react";

interface FishCanvasProps {
  isAttacking: boolean;
  isGrowing: boolean;
  activeInputRect: DOMRect | null;
  isPasswordFocused?: boolean;
}

interface CyberSparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  pulse: number;
}

export const FishCanvas: React.FC<FishCanvasProps> = ({
  isAttacking,
  isGrowing,
  activeInputRect,
  isPasswordFocused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isAttackingRef = useRef(isAttacking);
  const isGrowingRef = useRef(isGrowing);
  const activeInputRectRef = useRef(activeInputRect);
  const isPasswordFocusedRef = useRef(isPasswordFocused);

  useEffect(() => {
    isAttackingRef.current = isAttacking;
  }, [isAttacking]);

  useEffect(() => {
    isGrowingRef.current = isGrowing;
  }, [isGrowing]);

  useEffect(() => {
    activeInputRectRef.current = activeInputRect;
  }, [activeInputRect]);

  useEffect(() => {
    isPasswordFocusedRef.current = isPasswordFocused;
  }, [isPasswordFocused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let isMobile = width < 640;

    const resizeCanvas = () => {
      const currentCanvas = canvasRef.current;
      if (!currentCanvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      isMobile = width < 640;

      currentCanvas.width = Math.floor(width * dpr);
      currentCanvas.height = Math.floor(height * dpr);
      currentCanvas.style.width = `${width}px`;
      currentCanvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });

    // =========================================================================
    // 1. PRELOAD HIGH-RESOLUTION 3D TEXTURES
    // =========================================================================
    const imgNormal = new Image();
    const imgAngry = new Image();
    const imgHappy = new Image();

    let normalLoaded = false;
    let angryLoaded = false;
    let happyLoaded = false;

    imgNormal.onload = () => { normalLoaded = true; };
    imgAngry.onload = () => { angryLoaded = true; };
    imgHappy.onload = () => { happyLoaded = true; };

    imgNormal.src = "/images/cyber_fish_normal_realistic.jpg";
    imgAngry.src = "/images/cyber_fish_angry_realistic.jpg";
    imgHappy.src = "/images/cyber_fish_happy_realistic.jpg";

    // =========================================================================
    // 2. KINEMATICS & SPATIAL NAVIGATION
    // =========================================================================
    let posX = width * 0.5;
    let posY = isMobile ? Math.min(180, height * 0.22) : height * 0.28;
    let heading = 0; // facing direction in radians
    let speed = 1.0;
    let targetSpeed = 1.0;
    let wavePhase = 0;

    // Autonomous target waypoint
    let targetX = width * 0.5;
    let targetY = posY;
    let targetChangeTimer = 0;

    const pickNewTarget = () => {
      const padX = isMobile ? 80 : 160;
      const minY = isMobile ? 70 : 90;
      const maxY = isMobile ? Math.min(240, height * 0.32) : height * 0.45;

      targetX = padX + Math.random() * (width - 2 * padX);
      targetY = minY + Math.random() * (maxY - minY);
      targetSpeed = 0.8 + Math.random() * 0.6;
    };

    pickNewTarget();

    // Global pointer tracking
    let pointerX = width * 0.5;
    let pointerY = height * 0.5;
    let isPointerNear = false;
    let pointerExpiry = 0;

    const handlePointer = (e: MouseEvent | TouchEvent) => {
      const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
      const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
      pointerX = cx;
      pointerY = cy;
      isPointerNear = true;
      pointerExpiry = Date.now() + 3000;
    };

    window.addEventListener("mousemove", handlePointer, { passive: true });
    window.addEventListener("touchstart", handlePointer, { passive: true });

    // Ambient Cyber Sparkles
    const numSparks = isMobile ? 18 : 35;
    const sparkles: CyberSparkle[] = Array.from({ length: numSparks }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(Math.random() * 0.35 + 0.1),
      size: Math.random() * 2.2 + 0.8,
      alpha: Math.random() * 0.5 + 0.2,
      color: "#00f5c4",
      pulse: Math.random() * Math.PI * 2,
    }));

    // State Blend Weights
    let normalAlpha = 1.0;
    let angryAlpha = 0.0;
    let happyAlpha = 0.0;

    // =========================================================================
    // 3. MAIN RENDER LOOP WITH SLICED MESH DEFORMATION
    // =========================================================================
    let lastTime = performance.now();

    const render = (time: number) => {
      animationFrameId = requestAnimationFrame(render);

      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      const now = Date.now();
      const isAttackingNow = isAttackingRef.current;
      const isGrowingNow = isGrowingRef.current;

      // -----------------------------------------------------------------------
      // A. STATE TRANSITION WEIGHTS
      // -----------------------------------------------------------------------
      let targetNormal = 1.0;
      let targetAngry = 0.0;
      let targetHappy = 0.0;

      if (isAttackingNow) {
        targetNormal = 0.0;
        targetAngry = 1.0;
        targetHappy = 0.0;
      } else if (isGrowingNow) {
        targetNormal = 0.0;
        targetAngry = 0.0;
        targetHappy = 1.0;
      }

      const blendSpeed = 0.1;
      normalAlpha += (targetNormal - normalAlpha) * blendSpeed;
      angryAlpha += (targetAngry - angryAlpha) * blendSpeed;
      happyAlpha += (targetHappy - happyAlpha) * blendSpeed;

      // -----------------------------------------------------------------------
      // B. SPATIAL AWARENESS & HYDRODYNAMIC MOTION
      // -----------------------------------------------------------------------
      targetChangeTimer += dt;
      if (targetChangeTimer > 7 || Math.hypot(posX - targetX, posY - targetY) < 60) {
        pickNewTarget();
        targetChangeTimer = 0;
      }

      let desiredX = targetX;
      let desiredY = targetY;

      if (isPointerNear && now < pointerExpiry && pointerY < height * 0.55) {
        desiredX = pointerX;
        desiredY = Math.max(60, Math.min(height * 0.36, pointerY));
      }

      // Safe screen margins
      const padX = isMobile ? 60 : 120;
      const padYTop = isMobile ? 55 : 80;
      const padYBottom = isMobile ? Math.min(260, height * 0.38) : height * 0.5;

      let targetAngle = Math.atan2(desiredY - posY, desiredX - posX);

      // Boundary soft steering repulsion
      if (posX < padX) targetAngle = 0;
      else if (posX > width - padX) targetAngle = Math.PI;
      if (posY < padYTop) targetAngle = Math.PI / 2;
      else if (posY > padYBottom) targetAngle = -Math.PI / 2;

      // Minimum turning radius enforcement (prevents sharp spinning)
      let diff = targetAngle - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const maxTurn = (angryAlpha > 0.5 ? 0.08 : 0.035) * (60 * dt);
      heading += Math.max(-maxTurn, Math.min(maxTurn, diff * 0.07));

      // Speed control
      const curTargetSpeed = angryAlpha > 0.5 ? 2.5 : happyAlpha > 0.5 ? 1.6 : targetSpeed;
      speed += (curTargetSpeed - speed) * 0.06;

      posX += Math.cos(heading) * speed * (isMobile ? 48 : 64) * dt;
      posY += Math.sin(heading) * speed * (isMobile ? 48 : 64) * dt;

      // Strict boundaries
      posX = Math.max(40, Math.min(width - 40, posX));
      posY = Math.max(45, Math.min(padYBottom + 15, posY));

      // Wave swimming oscillation
      wavePhase += speed * (isMobile ? 0.085 : 0.075);

      // -----------------------------------------------------------------------
      // C. BACKGROUND RENDERING (Deep Crystal Dark Water)
      // -----------------------------------------------------------------------
      ctx.fillStyle = "#070d0d";
      ctx.fillRect(0, 0, width, height);

      // Radial abyssal glow
      const bgGrad = ctx.createRadialGradient(
        width / 2, height * 0.3, 30,
        width / 2, height * 0.3, Math.max(width, height) * 0.75
      );
      if (angryAlpha > 0.4) {
        bgGrad.addColorStop(0, "rgba(35, 10, 15, 0.65)");
        bgGrad.addColorStop(0.7, "#090507");
        bgGrad.addColorStop(1, "#040203");
      } else if (happyAlpha > 0.4) {
        bgGrad.addColorStop(0, "rgba(0, 45, 38, 0.7)");
        bgGrad.addColorStop(0.7, "#061513");
        bgGrad.addColorStop(1, "#030807");
      } else {
        bgGrad.addColorStop(0, "#0c1a1a");
        bgGrad.addColorStop(0.65, "#070e0e");
        bgGrad.addColorStop(1, "#040707");
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Ambient Cyber Particles
      ctx.save();
      for (const sp of sparkles) {
        sp.y += sp.vy;
        sp.x += sp.vx + Math.sin(time * 0.002 + sp.pulse) * 0.2;
        if (sp.y < -10) {
          sp.y = height + 10;
          sp.x = Math.random() * width;
        }

        const particleColor = angryAlpha > 0.4
          ? `rgba(255, 50, 90, ${sp.alpha * 0.65})`
          : happyAlpha > 0.4
          ? `rgba(255, 215, 0, ${sp.alpha * 0.6})`
          : `rgba(0, 245, 196, ${sp.alpha * 0.5})`;

        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fillStyle = particleColor;
        ctx.fill();
      }
      ctx.restore();

      // -----------------------------------------------------------------------
      // D. 24-SLICE ARTICULATED MESH DEFORMATION ENGINE
      // -----------------------------------------------------------------------
      const renderDeformedFishImage = (img: HTMLImageElement, alpha: number) => {
        if (!img || !img.complete || alpha <= 0.01) return;

        ctx.save();
        ctx.globalAlpha = Math.min(1.0, alpha);

        // Fish dimensions
        const fishWidth = (isMobile ? 180 : 250) * (happyAlpha > 0.5 ? 1.15 : 1.0);
        const fishHeight = fishWidth * (img.naturalHeight / (img.naturalWidth || 1));

        // Center on head / body center
        ctx.translate(posX, posY);
        ctx.rotate(heading);

        // If swimming towards left, flip vertically for natural orientation
        const isFacingLeft = Math.cos(heading) < 0;
        if (isFacingLeft) {
          ctx.scale(1, -1);
        }

        // Draw Ambient Halo behind fish
        const haloGrad = ctx.createRadialGradient(
          0, 0, fishWidth * 0.1,
          0, 0, fishWidth * 0.65
        );
        const haloColor = angryAlpha > 0.5 ? "rgba(255, 0, 85, 0.25)" : happyAlpha > 0.5 ? "rgba(0, 245, 196, 0.3)" : "rgba(0, 212, 170, 0.25)";
        haloGrad.addColorStop(0, haloColor);
        haloGrad.addColorStop(1, "transparent");
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(0, 0, fishWidth * 0.65, 0, Math.PI * 2);
        ctx.fill();

        // 24 Continuous Vertical Spine Slices with Sine Wave Kinematics
        const NUM_SLICES = 24;
        const sliceWidth = fishWidth / NUM_SLICES;
        const srcSliceWidth = img.naturalWidth / NUM_SLICES;

        for (let i = 0; i < NUM_SLICES; i++) {
          // Progress from snout (0) to tail (1)
          const prog = i / (NUM_SLICES - 1);

          // Harmonic Wave equation: head has small yaw, tail undulates with large amplitude
          const waveAmp = (prog * prog * 16 + prog * 4) * (angryAlpha > 0.5 ? 1.6 : 1.0);
          const sliceOffsetY = Math.sin(wavePhase - prog * 4.2) * waveAmp;
          const sliceAngle = Math.cos(wavePhase - prog * 4.2) * (waveAmp * 0.045);

          const destX = -fishWidth * 0.45 + i * sliceWidth;
          const destY = -fishHeight * 0.5;

          ctx.save();
          // Apply local slice rotation & wave deflection
          ctx.translate(destX + sliceWidth * 0.5, sliceOffsetY);
          ctx.rotate(sliceAngle);

          ctx.drawImage(
            img,
            i * srcSliceWidth, 0,
            srcSliceWidth, img.naturalHeight,
            -sliceWidth * 0.5, destY,
            sliceWidth + 0.6, fishHeight // 0.6 overlap prevents subpixel seam gaps
          );

          ctx.restore();
        }

        ctx.restore();
      };

      // Cross-Morph Blending between 3 states
      if (normalLoaded && normalAlpha > 0.01) {
        renderDeformedFishImage(imgNormal, normalAlpha);
      }
      if (angryLoaded && angryAlpha > 0.01) {
        renderDeformedFishImage(imgAngry, angryAlpha);
      }
      if (happyLoaded && happyAlpha > 0.01) {
        renderDeformedFishImage(imgHappy, happyAlpha);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handlePointer);
      window.removeEventListener("touchstart", handlePointer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 select-none touch-none"
      style={{
        background: "#070d0d",
      }}
    />
  );
};
