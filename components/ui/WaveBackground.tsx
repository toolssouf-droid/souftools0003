"use client";

import React, { useEffect, useRef } from "react";

export function WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    let step = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      step += 0.02;

      // Draw 3 flowing 3D wave lines
      const waveColors = ["rgba(0, 212, 170, 0.25)", "rgba(14, 165, 233, 0.2)", "rgba(0, 255, 136, 0.15)"];

      waveColors.forEach((color, waveIndex) => {
        ctx.beginPath();
        ctx.lineWidth = 2 + waveIndex;
        ctx.strokeStyle = color;

        for (let x = 0; x <= width; x += 10) {
          const y =
            height / 2 +
            Math.sin(x * 0.005 + step + waveIndex) * 40 +
            Math.cos(x * 0.003 + step * 0.8) * 30;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.shadowBlur = 15;
        ctx.shadowColor = "#00d4aa";
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // Draw floating nodes along the wave
      for (let i = 0; i < 8; i++) {
        const nx = ((step * 60 + i * 180) % (width + 100)) - 50;
        const ny = height / 2 + Math.sin(nx * 0.005 + step) * 40 + Math.cos(nx * 0.003 + step * 0.8) * 30;

        ctx.beginPath();
        ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#00d4aa";
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#00d4aa";
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0 w-full h-full opacity-70"
    />
  );
}
