"use client";

import { resolveEliteBadges } from "@/lib/eliteStatus";
import { useLocale } from "@/contexts/LocaleContext";

type EliteStatusBadgesProps = {
  subject: any;
  isDark?: boolean;
  compact?: boolean;
  className?: string;
};

const TOKENS = {
  admin: {
    dark: { bg: "rgba(168,85,247,0.18)", border: "rgba(168,85,247,0.55)", text: "#C4B5FD" },
    light: { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.4)", text: "#6D28D9" },
  },
  agent: {
    dark: { bg: "rgba(255,149,0,0.20)", border: "rgba(255,159,10,0.70)", text: "#FFB340" },
    light: { bg: "rgba(255,149,0,0.12)", border: "rgba(255,149,0,0.50)", text: "#C96C00" },
  },
  partner: {
    dark: { bg: "rgba(212,175,55,0.15)", border: "rgba(212,175,55,0.55)", text: "#E8D5A3" },
    light: { bg: "rgba(212,175,55,0.10)", border: "rgba(212,175,55,0.45)", text: "#9A7B2F" },
  },
  investorPro: {
    dark: { bg: "rgba(184,189,199,0.20)", border: "rgba(202,208,219,0.72)", text: "#E4E9F2" },
    light: { bg: "rgba(226,232,240,0.92)", border: "rgba(100,116,139,0.55)", text: "#111111" },
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
  const { dict } = useLocale();
  const b = dict.badges;
  const { isAdmin, isAgent, isProgramPartner, isInvestorPro } = resolveEliteBadges(subject);
  if (!isAdmin && !isAgent && !isProgramPartner && !isInvestorPro) return null;

  const tone = isDark ? "dark" : "light";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {isAdmin && <Badge label={b.admin} theme={TOKENS.admin[tone]} compact={compact} />}
      {isAgent && <Badge label={b.agent} theme={TOKENS.agent[tone]} compact={compact} />}
      {isProgramPartner && (
        <Badge label={b.partner} theme={TOKENS.partner[tone]} compact={compact} />
      )}
      {isInvestorPro && (
        <Badge label={b.investorPro} theme={TOKENS.investorPro[tone]} compact={compact} />
      )}
    </div>
  );
}
