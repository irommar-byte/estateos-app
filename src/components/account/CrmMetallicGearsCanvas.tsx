'use client';

import { useEffect, useRef } from 'react';
import {
  buildGearTrain,
  drawMetallicGear,
  resolveTrainAngles,
  type GearDrawSpec,
} from '@/components/account/crmGearCanvas';

type Props = {
  mode: 'button' | 'portal';
  active?: boolean;
  boost?: boolean;
  className?: string;
};

export function CrmMetallicGearsCanvas({ mode, active = false, boost = false, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const angleRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth || (mode === 'portal' ? window.innerWidth : 320);
      const h = parent?.clientHeight || (mode === 'portal' ? window.innerHeight : 140);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas.parentElement || canvas);
    window.addEventListener('resize', resize);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let last = performance.now();

    const draw = (t: number) => {
      const { w, h, dpr } = sizeRef.current;
      if (w <= 0 || h <= 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;

      const speed = boost ? 2.2 : active ? 1.05 : 0.42;
      angleRef.current += dt * speed;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (mode === 'portal') {
        const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
        bg.addColorStop(0, 'rgba(212, 175, 55, 0.06)');
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
      }

      const train = buildGearTrain(w, h, mode);
      const angles = resolveTrainAngles(train, angleRef.current);
      const intensity = boost ? 1.35 : active ? 1.15 : 1;

      for (let i = 0; i < train.length; i++) {
        const node = train[i]!;
        const spec: GearDrawSpec = {
          teeth: node.teeth,
          outerR: node.outerR,
          rootR: node.rootR,
          holeR: node.holeR,
          x: node.x,
          y: node.y,
          angle: angles[i]!,
          dir: node.dir,
        };
        drawMetallicGear(ctx, spec, intensity);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [mode, active, boost]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
    />
  );
}
