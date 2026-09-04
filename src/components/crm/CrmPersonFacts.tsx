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
    <div
      className="overflow-hidden rounded-[22px] border border-[var(--eos-border)] bg-[var(--eos-card)] px-5 py-1 shadow-[0_18px_40px_rgba(28,25,23,0.06)]"
      style={appleFace}
    >
      {rows.map((row, index) => {
        const phone = row.label === "Telefon" && !row.muted ? polishPhoneParts(row.value) : null;
        const peselHint = row.label === "PESEL" && !row.muted ? formatPeselDecode(row.value) : null;
        const body = (
          <div
            className={`py-3.5 ${index < rows.length - 1 ? "border-b border-[var(--eos-border)]" : ""}`}
          >
            <p className="mb-1 text-[11px] font-medium tracking-[0.06em] text-[var(--eos-muted)]" style={appleFace}>
              {row.label}
            </p>
            {phone ? (
              <p className="flex items-baseline gap-2 text-left text-[17px] font-medium tracking-[-0.41px] text-[var(--eos-text)]" style={appleFace}>
                <span className="text-[15px] leading-none">{phone.flag}</span>
                <span className="text-[15px] font-medium text-[var(--eos-muted)]">{phone.dial}</span>
                <span className="tracking-[0.04em] tabular-nums">{phone.national}</span>
              </p>
            ) : (
              <div>
                <p
                  className={`text-left text-[17px] tracking-[-0.41px] tabular-nums ${
                    row.muted ? "font-normal text-[var(--eos-muted)]" : "font-medium text-[var(--eos-text)]"
                  }`}
                  style={appleFace}
                >
                  {row.value}
                </p>
                {peselHint ? (
                  <p className="mt-1 text-[13px] font-normal tracking-[-0.08px] text-[var(--eos-muted)]" style={appleFace}>
                    {peselHint}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        );
        if (row.href) {
          return (
            <a key={`${row.label}-${index}`} href={row.href} className="block active:opacity-55">
              {body}
            </a>
          );
        }
        return <div key={`${row.label}-${index}`}>{body}</div>;
      })}
    </div>
  );
}
