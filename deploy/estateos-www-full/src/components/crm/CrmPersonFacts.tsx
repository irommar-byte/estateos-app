"use client";

type Fact = {
  label: string;
  value: string;
  href?: string | null;
  muted?: boolean;
};

const appleFace = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
} as const;

function formatFactValue(label: string, value: string) {
  if (label !== "Telefon") return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("48")) {
    return `+48 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return value;
}

export default function CrmPersonFacts({ rows }: { rows: Fact[] }) {
  return (
    <div className="overflow-hidden rounded-[12px] bg-[var(--eos-input)]" style={appleFace}>
      {rows.map((row, index) => {
        const display = formatFactValue(row.label, row.value);
        const valueClass = [
          "min-w-0 flex-1 text-right text-[17px] leading-[22px] tracking-[-0.41px] tabular-nums",
          row.muted ? "font-normal text-[var(--eos-muted)]" : "font-semibold text-[var(--eos-text)]",
          row.href && !row.muted ? "text-[#007AFF]" : "",
        ].join(" ");
        const body = (
          <div
            className={`flex min-h-[44px] items-center gap-3 px-4 py-[11px] ${
              index < rows.length - 1 ? "border-b border-[var(--eos-border)]" : ""
            }`}
          >
            <p className="shrink-0 text-[15px] font-normal tracking-[-0.24px] text-[var(--eos-muted)]" style={appleFace}>
              {row.label}
            </p>
            <p className={valueClass} style={appleFace}>
              {display}
            </p>
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
