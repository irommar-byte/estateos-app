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
  agent: {
    dark: { bg: "rgba(255,149,0,0.20)", border: "rgba(255,159,10,0.70)", text: "#FFB340" },
    light: { bg: "rgba(255,149,0,0.12)", border: "rgba(255,149,0,0.50)", text: "#C96C00" },
  },
  partner: {
    dark: { bg: "rgba(255,149,0,0.14)", border: "rgba(255,159,10,0.55)", text: "#FF9F40" },
    light: { bg: "rgba(255,149,0,0.10)", border: "rgba(255,149,0,0.40)", text: "#B86E00" },
  },
  investorPro: {
    dark: { bg: "rgba(184,189,199,0.20)", border: "rgba(202,208,219,0.72)", text: "#E4E9F2" },
    light: { bg: "rgba(124,136,152,0.12)", border: "rgba(124,136,152,0.45)", text: "#5D6A7D" },
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
  const role = String(subject?.role || subject?.user?.role || "")
    .trim()
    .toUpperCase();
  const isAdmin = role === "ADMIN";
  const badges = resolveEliteBadges(subject);

  const showAgent = isAdmin || badges.isAgent;
  const showPartner = isAdmin || badges.isProgramPartner;
  const showPro = isAdmin || badges.isInvestorPro;

  if (!showAgent && !showPartner && !showPro) return null;

  const tone = isDark ? "dark" : "light";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {showAgent ? (
        <Badge label={dict.badges.agent} theme={TOKENS.agent[tone]} compact={compact} />
      ) : null}
      {showPartner ? (
        <Badge label={dict.badges.partner} theme={TOKENS.partner[tone]} compact={compact} />
      ) : null}
      {showPro ? (
        <Badge label={dict.badges.investorPro} theme={TOKENS.investorPro[tone]} compact={compact} />
      ) : null}
    </div>
  );
}
