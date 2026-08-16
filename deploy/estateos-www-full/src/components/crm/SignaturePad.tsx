"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";

export default function SignaturePad({
  onChange,
  disabled = false,
}: {
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const snapshot = hasInk ? canvas.toDataURL("image/png") : null;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    if (snapshot) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height);
      image.src = snapshot;
    }
  }, [hasInk]);

  useEffect(() => {
    prepareCanvas();
    window.addEventListener("resize", prepareCanvas);
    return () => window.removeEventListener("resize", prepareCanvas);
  }, [prepareCanvas]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastRef.current = point(event);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const ctx = event.currentTarget.getContext("2d");
    const previous = lastRef.current;
    const next = point(event);
    if (!ctx || !previous) return;
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    lastRef.current = next;
    if (!hasInk) setHasInk(true);
  };

  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    if (hasInk || !disabled) onChange(event.currentTarget.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange("");
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
          <PenLine className="size-3.5" />
          Podpis klienta
        </p>
        <button
          type="button"
          disabled={disabled || !hasInk}
          onClick={clear}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--eos-border)] px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--eos-muted)] disabled:opacity-40"
        >
          <Eraser className="size-3" />
          Wyczyść
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="h-44 w-full touch-none rounded-2xl border border-[var(--eos-border)] bg-white shadow-inner"
        aria-label="Pole podpisu klienta"
      />
      <p className="mt-2 text-xs leading-relaxed text-[var(--eos-muted)]">
        Podpisz rysikiem lub palcem. Podpis, czas i skrót dokumentu zostaną utrwalone w kopii.
      </p>
    </div>
  );
}
