import type { Locale } from "@/i18n/config";

export type PulseHeadlineType = "LISTING" | "METRIC" | "INTEL" | "GLOBAL";

export type PulseHeadline = {
  id: string;
  type: PulseHeadlineType;
  title: string;
  source: string;
};

export type PulseEventIcon =
  | "UserPlus"
  | "HandCoins"
  | "CheckCircle2"
  | "Zap"
  | "TrendingUp";

export type PulseEvent = {
  id: string;
  icon: PulseEventIcon;
  color: string;
  text: string;
};

export type DemandLevel = "high" | "medium" | "low";

export function demandLabelForLevel(level: DemandLevel, locale: Locale): string {
  if (locale === "pl") {
    if (level === "high") return "Wysoki";
    if (level === "medium") return "Umiarkowany";
    return "Stabilny";
  }
  if (locale === "uk") {
    if (level === "high") return "Високий";
    if (level === "medium") return "Помірний";
    return "Стабільний";
  }
  if (level === "high") return "High";
  if (level === "medium") return "Moderate";
  return "Stable";
}
