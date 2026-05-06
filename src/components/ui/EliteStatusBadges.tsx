"use client";

import { resolveEliteBadges } from "@/lib/eliteStatus";

type EliteStatusBadgesProps = {
  subject: any;
  isDark?: boolean;
  compact?: boolean;
  className?: string;
};

const TOKENS = {
  partner: {
    dark: {
      bg: "rgba(255,149,0,0.20)",
      border: "rgba(255,159,10,0.70)",
      text: "#FFB340",
    },
    light: {
      bg: "rgba(255,149,0,0.12)",
      border: "rgba(255,149,0,0.50)",
      text: "#C96C00",
    },
  },
  investorPro: {
    dark: {
      bg: "rgba(184,189,199,0.20)",
      border: "rgba(202,208,219,0.72)",
      text: "#E4E9F2",
    },
    light: {
      bg: "rgba(124,136,152,0.12)",
      border: "rgba(124,136,152,0.45)",
      text: "#5D6A7D",
    },
  },
} as const;

function Badge({
  label,
  theme,
  compact,
}: {
  label: string;
  theme: { bg: string; border: string; text: string };
  compact: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-black uppercase tracking-wider ${
        compact ? "px-2 py-0.5 text-[9px]" : "px-3 py-1 text-[10px]"
      }`}
      style={{
        background: theme.bg,
        borderColor: theme.border,
        color: theme.text,
      }}
    >
      {label}
    </span>
  );
}

export default function EliteStatusBadges({
  subject,
  isDark = true,
  compact = false,
  className = "",
}: EliteStatusBadgesProps) {
  const { isPartner, isInvestorPro } = resolveEliteBadges(subject);
  if (!isPartner && !isInvestorPro) return null;

  const tone = isDark ? "dark" : "light";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {isPartner && (
        <Badge
          label="Partner EstateOS"
          theme={TOKENS.partner[tone]}
          compact={compact}
        />
      )}
      {isInvestorPro && (
        <Badge
          label="Investor Pro"
          theme={TOKENS.investorPro[tone]}
          compact={compact}
        />
      )}
    </div>
  );
}
