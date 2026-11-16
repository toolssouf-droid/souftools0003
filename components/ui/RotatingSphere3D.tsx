"use client";

import React, { useEffect, useRef } from "react";

export function RotatingSphere3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const size = 320;
    canvas.width = size;
    canvas.height = size;

    const radius = 100;
    const center = size / 2;
    let angleY = 0;
    let angleX = 0.3;

    // Generate 3D sphere points
    const points: { x: number; y: number; z: number }[] = [];
    const numLat = 16;
    const numLon = 24;

    for (let i = 0; i <= numLat; i++) {
      const theta = (i * Math.PI) / numLat;
      for (let j = 0; j < numLon; j++) {
        const phi = (j * 2 * Math.PI) / numLon;
        const x = radius * Math.sin(theta) * Math.cos(phi);
        const y = radius * Math.cos(theta);
        const z = radius * Math.sin(theta) * Math.sin(phi);
        points.push({ x, y, z });
      }
    }

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      // Radial outer glow
      const grad = ctx.createRadialGradient(center, center, 20, center, center, 140);
      grad.addColorStop(0, "rgba(0, 212, 170, 0.25)");
      grad.addColorStop(0.6, "rgba(14, 165, 233, 0.1)");
      grad.addColorStop(1, "rgba(10, 15, 15, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(center, center, 140, 0, Math.PI * 2);
      ctx.fill();

      angleY += 0.012;
      angleX += 0.003;

      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      // Project and draw points
      const projected: { px: number; py: number; scale: number; z: number }[] = [];

      points.forEach((p) => {
        // Rotate Y
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;

        // Rotate X
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        const fov = 300;
        const scale = fov / (fov + z2);
        const px = center + x1 * scale;
        const py = center + y2 * scale;

        projected.push({ px, py, scale, z: z2 });
      });

      // Sort by Z for proper depth
      projected.sort((a, b) => b.z - a.z);

      // Draw connections for nearby points on sphere
      ctx.strokeStyle = "rgba(0, 212, 170, 0.2)";
      ctx.lineWidth = 0.8;

      projected.forEach((p) => {
        const alpha = Math.max(0.1, (p.z + radius) / (2 * radius));
        ctx.beginPath();
        ctx.arc(p.px, p.py, 1.8 * p.scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 170, ${alpha * 0.9})`;
        ctx.shadowBlur = 8 * alpha;
        ctx.shadowColor = "#00d4aa";
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw a glowing central SoufTools core ring
      ctx.beginPath();
      ctx.ellipse(center, center, 120, 35, angleY * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 255, 136, 0.4)";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#00ff88";
      ctx.stroke();
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative flex items-center justify-center p-2 sm:p-4 max-w-full">
      <div className="absolute w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-[#00d4aa]/15 blur-3xl -z-10" />
      <canvas ref={canvasRef} className="w-full max-w-[260px] sm:max-w-[320px] aspect-square rounded-full shadow-2xl shadow-[#00d4aa]/20" />
    </div>
  );
}
