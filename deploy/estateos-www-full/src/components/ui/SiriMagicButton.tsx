"use client";

import { useEffect, useId, useState } from "react";

type SiriMagicButtonProps = {
  label: string;
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
};

/** Siri-like living rainbow CTA for AI description generation. */
export default function SiriMagicButton({
  label,
  busyLabel = "Tworzę opis…",
  busy = false,
  disabled = false,
  onClick,
  className = "",
}: SiriMagicButtonProps) {
  const reactId = useId().replace(/:/g, "");
  const gradId = `siri-grad-${reactId}`;
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (busy || disabled) return;
    const id = window.setInterval(() => setPulse((p) => (p + 1) % 1000), 40);
    return () => window.clearInterval(id);
  }, [busy, disabled]);

  const shift = (pulse % 360);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      className={`siri-magic-btn group relative inline-flex min-h-[48px] items-center justify-center overflow-hidden rounded-full px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
      style={{
        ["--siri-shift" as string]: `${shift}deg`,
      }}
    >
      <span className="siri-magic-btn__glow" aria-hidden />
      <span className="siri-magic-btn__sheen" aria-hidden />
      <span className="relative z-[1] inline-flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0 drop-shadow-[0_0_8px_rgba(255,255,255,0.55)]" aria-hidden>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff375f" />
              <stop offset="35%" stopColor="#bf5af2" />
              <stop offset="65%" stopColor="#64d2ff" />
              <stop offset="100%" stopColor="#30d158" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#${gradId})`}
            d="M12 2.2c.35 0 .64.26.7.6l.55 3.2a5.8 5.8 0 0 0 4.75 4.75l3.2.55a.72.72 0 0 1 0 1.4l-3.2.55a5.8 5.8 0 0 0-4.75 4.75l-.55 3.2a.72.72 0 0 1-1.4 0l-.55-3.2A5.8 5.8 0 0 0 6.8 13.25l-3.2-.55a.72.72 0 0 1 0-1.4l3.2-.55A5.8 5.8 0 0 0 11.55 6l.55-3.2c.06-.34.35-.6.7-.6Z"
          />
        </svg>
        <span>{busy ? busyLabel : label}</span>
      </span>
    </button>
  );
}
