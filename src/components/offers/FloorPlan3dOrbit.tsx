'use client';

import { useEffect, useRef } from 'react';
import type { FloorPlanScanMeta } from '@/types/roomScan';

type Props = {
  meta: FloorPlanScanMeta;
  className?: string;
};

export default function FloorPlan3dOrbit({ meta, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ yaw: 0.7, pitch: 0.55, dragging: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const walls = meta.walls || [];
    const objects = meta.objects || [];
    const height = meta.ceilingHeightM && meta.ceilingHeightM > 1.5 ? meta.ceilingHeightM : 2.6;
    const b = meta.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 4);

    const project = (x: number, y: number, z: number, yaw: number, pitch: number, w: number, h: number) => {
      const dx = x - cx;
      const dz = z - cz;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const rx = dx * cosY - dz * sinY;
      const rz = dx * sinY + dz * cosY;
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const ry = y * cosP - rz * sinP;
      const depth = y * sinP + rz * cosP + span * 1.8;
      const scale = (Math.min(w, h) * 0.72) / Math.max(span, 1) / Math.max(depth / (span * 1.6), 0.55);
      return { x: w / 2 + rx * scale, y: h / 2 - ry * scale, depth };
    };

    const draw = () => {
      const w = canvas.clientWidth * window.devicePixelRatio;
      const h = canvas.clientHeight * window.devicePixelRatio;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const { yaw, pitch } = stateRef.current;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, w, h);

      const quads: Array<{ pts: Array<{ x: number; y: number }>; fill: string; stroke: string; depth: number }> = [];

      for (const wall of walls) {
        const len = Math.hypot(wall.x2 - wall.x1, wall.z2 - wall.z1);
        if (len < 0.12) continue;
        const p1 = project(wall.x1, 0, wall.z1, yaw, pitch, w, h);
        const p2 = project(wall.x2, 0, wall.z2, yaw, pitch, w, h);
        const p3 = project(wall.x2, height, wall.z2, yaw, pitch, w, h);
        const p4 = project(wall.x1, height, wall.z1, yaw, pitch, w, h);
        quads.push({
          pts: [p1, p2, p3, p4],
          fill: 'rgba(148,163,184,0.22)',
          stroke: 'rgba(226,232,240,0.85)',
          depth: (p1.depth + p2.depth + p3.depth + p4.depth) / 4,
        });
      }

      for (const obj of objects) {
        const ww = Math.max(0.35, obj.widthM || 0.5);
        const dd = Math.max(0.3, obj.depthM || 0.4);
        const hh = Math.min(1.1, obj.heightM || 0.7);
        const corners = [
          [obj.centerX - ww / 2, 0, obj.centerZ - dd / 2],
          [obj.centerX + ww / 2, 0, obj.centerZ - dd / 2],
          [obj.centerX + ww / 2, 0, obj.centerZ + dd / 2],
          [obj.centerX - ww / 2, 0, obj.centerZ + dd / 2],
        ] as const;
        const top = corners.map(([x, , z]) => project(x, hh, z, yaw, pitch, w, h));
        const depth = top.reduce((s, p) => s + p.depth, 0) / top.length;
        quads.push({
          pts: top,
          fill: 'rgba(56,189,248,0.28)',
          stroke: 'rgba(125,211,252,0.9)',
          depth,
        });
      }

      quads.sort((a, b) => b.depth - a.depth);
      for (const quad of quads) {
        ctx.beginPath();
        ctx.moveTo(quad.pts[0].x, quad.pts[0].y);
        for (let i = 1; i < quad.pts.length; i += 1) ctx.lineTo(quad.pts[i].x, quad.pts[i].y);
        ctx.closePath();
        ctx.fillStyle = quad.fill;
        ctx.fill();
        ctx.strokeStyle = quad.stroke;
        ctx.lineWidth = 1.2 * window.devicePixelRatio;
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(148,163,184,0.9)';
      ctx.font = `${11 * window.devicePixelRatio}px ui-sans-serif`;
      ctx.fillText('Przeciągnij, aby obrócić model', 16 * window.devicePixelRatio, h - 16 * window.devicePixelRatio);
    };

    draw();
    const onMove = (clientX: number, clientY: number) => {
      const st = stateRef.current;
      if (!st.dragging) return;
      st.yaw += (clientX - st.lastX) * 0.008;
      st.pitch = Math.max(0.18, Math.min(1.25, st.pitch + (clientY - st.lastY) * 0.008));
      st.lastX = clientX;
      st.lastY = clientY;
      draw();
    };

    const down = (e: PointerEvent) => {
      stateRef.current.dragging = true;
      stateRef.current.lastX = e.clientX;
      stateRef.current.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => onMove(e.clientX, e.clientY);
    const up = () => {
      stateRef.current.dragging = false;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      ro.disconnect();
    };
  }, [meta]);

  return (
    <canvas
      ref={canvasRef}
      className={className || 'block h-[min(420px,58vw)] w-full cursor-grab touch-none bg-[#05070c] active:cursor-grabbing'}
    />
  );
}
