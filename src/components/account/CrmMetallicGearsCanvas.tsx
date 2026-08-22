'use client';

import { useEffect, useRef } from 'react';
import {
  buildGearTrain,
  drawMetallicGear,
  resolveTrainAngles,
  type GearDrawSpec,
} from '@/components/account/crmGearCanvas';

export type GearAnimPhase = 'idle' | 'spin' | 'scatter';

type ScatterParticle = {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  va: number;
  alpha: number;
  outerR: number;
  spec: Omit<GearDrawSpec, 'x' | 'y' | 'angle'>;
};

type Props = {
  mode: 'button' | 'portal';
  active?: boolean;
  boost?: boolean;
  phase?: GearAnimPhase;
  className?: string;
  onScatterComplete?: () => void;
};

const SCATTER_DIRS = [
  { vx: -520, vy: -380, va: -9 },
  { vx: 480, vy: -420, va: 11 },
  { vx: -340, vy: 460, va: -8 },
  { vx: 560, vy: 320, va: 10 },
];

export function CrmMetallicGearsCanvas({
  mode,
  active = false,
  boost = false,
  phase = 'idle',
  className = '',
  onScatterComplete,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const angleRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const scatterRef = useRef<ScatterParticle[] | null>(null);
  const scatterDoneRef = useRef(false);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
    if (phase !== 'scatter') {
      scatterRef.current = null;
      scatterDoneRef.current = false;
    }
  }, [phase]);

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

      const currentPhase = phaseRef.current;
      let speed = active ? 1.05 : 0.42;
      if (boost) speed = 2.2;
      if (currentPhase === 'spin') speed = 5.8;
      if (currentPhase === 'scatter') speed = 6.5;

      angleRef.current += dt * speed;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (mode === 'portal') {
        const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
        bg.addColorStop(0, 'rgba(212, 175, 55, 0.08)');
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
      }

      const train = buildGearTrain(w, h, mode);
      const angles = resolveTrainAngles(train, angleRef.current);
      const intensity =
        currentPhase === 'spin' ? 1.55 : currentPhase === 'scatter' ? 1.4 : boost ? 1.35 : active ? 1.15 : 1;

      if (currentPhase === 'scatter' && !scatterRef.current) {
        scatterRef.current = train.map((node, i) => {
          const dir = SCATTER_DIRS[i % SCATTER_DIRS.length]!;
          return {
            x: node.x,
            y: node.y,
            angle: angles[i]!,
            vx: dir.vx,
            vy: dir.vy,
            va: dir.va,
            alpha: 1,
            outerR: node.outerR,
            spec: {
              teeth: node.teeth,
              outerR: node.outerR,
              rootR: node.rootR,
              holeR: node.holeR,
              dir: node.dir,
            },
          };
        });
      }

      if (currentPhase === 'scatter' && scatterRef.current) {
        let allGone = true;
        for (const p of scatterRef.current) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.angle += p.va * dt;
          p.vx *= 1 + dt * 0.35;
          p.vy *= 1 + dt * 0.35;
          p.vy += 120 * dt;
          p.alpha = Math.max(0, p.alpha - dt * 1.35);
          if (p.alpha > 0.02) allGone = false;

          ctx.save();
          ctx.globalAlpha = p.alpha;
          drawMetallicGear(ctx, { ...p.spec, x: p.x, y: p.y, angle: p.angle }, intensity);
          ctx.restore();
        }

        if (allGone && !scatterDoneRef.current) {
          scatterDoneRef.current = true;
          onScatterComplete?.();
        }
      } else {
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
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [mode, active, boost, onScatterComplete]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
