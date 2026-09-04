"use client";

import { formatPeselDecode } from "@/lib/pesel";
import { flagEmojiFromIso2 } from "@/lib/location/localityDisplay";

type Fact = {
  label: string;
  value: string;
  href?: string | null;
  muted?: boolean;
};

const appleFace = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
} as const;

function polishPhoneParts(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 9 || (digits.length === 11 && digits.startsWith("48"))) {
    const national = digits.length === 11 ? digits.slice(2) : digits;
    return {
      flag: flagEmojiFromIso2("PL"),
      dial: "+48",
      national: `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`,
    };
  }
  return null;
}

export default function CrmPersonFacts({ rows }: { rows: Fact[] }) {
  return (
    <div className="overflow-hidden rounded-[12px] bg-[var(--eos-input)]" style={appleFace}>
      {rows.map((row, index) => {
        const phone = row.label === "Telefon" && !row.muted ? polishPhoneParts(row.value) : null;
        const peselHint = row.label === "PESEL" && !row.muted ? formatPeselDecode(row.value) : null;
        const valueClass = [
          "text-left text-[17px] leading-[22px] tracking-[-0.41px] tabular-nums",
          row.muted ? "font-normal text-[var(--eos-muted)]" : "font-semibold text-[var(--eos-text)]",
          row.href && !row.muted ? "text-[#007AFF]" : "",
        ].join(" ");
        const body = (
          <div
            className={`flex min-h-[52px] items-center gap-2 px-4 py-2.5 ${
              index < rows.length - 1 ? "border-b border-[var(--eos-border)]" : ""
            }`}
          >
            <div className="min-w-0 flex-1 text-left">
              <p className="mb-0.5 text-[13px] font-normal tracking-[-0.08px] text-[var(--eos-muted)]" style={appleFace}>
                {row.label}
              </p>
              {phone ? (
                <p className={`${valueClass} flex items-center gap-1.5`} style={appleFace}>
                  <span className="text-[18px] leading-none">{phone.flag}</span>
                  <span>{phone.dial}</span>
                  <span>{phone.national}</span>
                </p>
              ) : (
                <p className={`${valueClass} flex flex-wrap items-baseline gap-x-2 gap-y-0.5`} style={appleFace}>
                  <span>{row.value}</span>
                  {peselHint ? (
                    <span className="text-[15px] font-normal tracking-[-0.24px] text-[var(--eos-muted)]">{peselHint}</span>
                  ) : null}
                </p>
              )}
            </div>
            {row.href ? <span className="shrink-0 text-[15px] font-normal text-[#C7C7CC]">›</span> : null}
          </div>
        );
        if (row.href) {
          return (
            <a key={`${row.label}-${index}`} href={row.href} className="block active:bg-black/[0.04]">
              {body}
            </a>
          );
        }
        return <div key={`${row.label}-${index}`}>{body}</div>;
      })}
    </div>
  );
}
