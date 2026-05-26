/**
 * Kanoniczne reguły prowizji agenta (oferta) — mobile + backend muszą walidować identycznie.
 * Wartość to udział procentowy od ceny oferty (informacyjnie); rozliczenia poza platformą.
 */

export const AGENT_COMMISSION_MIN_NONZERO = 0.5;
export const AGENT_COMMISSION_MAX = 10;
export const AGENT_COMMISSION_STEP = 0.25;

/** Kody błędów — spójne z deploy/BACKEND_AGENT_ERROR_CODES.md */
export const AGENT_COMMISSION_ERROR_CODES = {
  INVALID_TYPE: "AGENT_COMMISSION_INVALID_TYPE",
  OUT_OF_RANGE: "AGENT_COMMISSION_OUT_OF_RANGE",
  INVALID_STEP: "AGENT_COMMISSION_INVALID_STEP",
} as const;

export type AgentCommissionErrorCode =
  (typeof AGENT_COMMISSION_ERROR_CODES)[keyof typeof AGENT_COMMISSION_ERROR_CODES];

export type AgentCommissionValidation =
  | { ok: true; value: number }
  | { ok: false; code: AgentCommissionErrorCode; message: string };

const EPS = 1e-6;

function isMultipleOfStep(value: number, step: number): boolean {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < EPS;
}

/**
 * Parsuje wejście (liczba lub string z przecinkiem) do liczby lub zwraca null.
 */
export function parseAgentCommissionPercent(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const normalized = raw.trim().replace("%", "").replace(",", ".");
    if (normalized === "") return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Walidacja: dozwolone jest dokładnie **0%** albo wartości z zakresu **[0,5; 10]** co **0,25**.
 */
export function validateAgentCommissionPercent(raw: unknown): AgentCommissionValidation {
  const parsed = parseAgentCommissionPercent(raw);
  if (parsed === null) {
    return {
      ok: false,
      code: AGENT_COMMISSION_ERROR_CODES.INVALID_TYPE,
      message: "agentCommissionPercent musi być liczbą (0 albo 0,5–10).",
    };
  }

  if (parsed === 0) {
    return { ok: true, value: 0 };
  }

  if (parsed < AGENT_COMMISSION_MIN_NONZERO - EPS || parsed > AGENT_COMMISSION_MAX + EPS) {
    return {
      ok: false,
      code: AGENT_COMMISSION_ERROR_CODES.OUT_OF_RANGE,
      message: `Poza zakresem: dozwolone 0% (bez prowizji) lub ${AGENT_COMMISSION_MIN_NONZERO}–${AGENT_COMMISSION_MAX}% ceny ofertowej brutto (maks. 10%).`,
    };
  }

  if (!isMultipleOfStep(parsed, AGENT_COMMISSION_STEP)) {
    return {
      ok: false,
      code: AGENT_COMMISSION_ERROR_CODES.INVALID_STEP,
      message: `Krok ${AGENT_COMMISSION_STEP}% (np. 0,5; 0,75; 1; …).`,
    };
  }

  return { ok: true, value: Math.round(parsed * 10000) / 10000 };
}

export const AGENT_COMMISSION_DEFAULT_PERCENT = 2.5;
export const AGENT_COMMISSION_ZERO_PERCENT = 0;

export type AgentCommissionInputMode = "percent" | "amount";

export function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}

export function isZeroCommissionPercent(percent: number | null | undefined): boolean {
  return percent !== null && percent !== undefined && Number.isFinite(percent) && percent === 0;
}

export function parseOfferNumeric(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return NaN;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  const s = String(raw)
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

export function computeAgentCommissionAmount(priceRaw: unknown, percent: number | null): number {
  if (percent === null || !Number.isFinite(percent)) return 0;
  const priceNum = parseOfferNumeric(priceRaw);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return 0;
  return Math.round((priceNum * percent) / 100);
}

export function maxAgentCommissionAmountPln(priceRaw: unknown): number {
  return computeAgentCommissionAmount(priceRaw, AGENT_COMMISSION_MAX);
}

export function percentFromCommissionAmount(
  priceRaw: unknown,
  amountRaw: unknown,
  options?: { clampToMax?: boolean },
): number | null {
  const price = parseOfferNumeric(priceRaw);
  const amount = parseOfferNumeric(amountRaw);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount < 0) return null;
  if (amount === 0) return 0;
  let percent = roundToQuarter((amount / price) * 100);
  if (options?.clampToMax && percent > AGENT_COMMISSION_MAX) {
    percent = AGENT_COMMISSION_MAX;
  }
  return percent;
}

export function commissionAmountInputToPercent(
  priceRaw: unknown,
  amountRaw: unknown,
): { percent: number; amountPln: number } | null {
  const price = parseOfferNumeric(priceRaw);
  let amount = parseOfferNumeric(amountRaw);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount < 0) return null;
  const maxAmt = maxAgentCommissionAmountPln(priceRaw);
  if (Number.isFinite(maxAmt) && maxAmt > 0 && amount > maxAmt) {
    amount = maxAmt;
  }
  const percent = percentFromCommissionAmount(price, amount);
  if (percent === null) return null;
  return { percent, amountPln: Math.round(amount) };
}

export function formatPercentLabel(percent: number): string {
  if (!Number.isFinite(percent)) return "—";
  if (percent === 0) return "0%";
  const rounded = roundToQuarter(percent);
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0$/, "").replace(/\.$/, "");
  return `${text.replace(".", ",")}%`;
}

export function formatPlnAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0 PLN";
  return `${Math.round(amount).toLocaleString("pl-PL")} PLN`;
}

export function isMobileAgentRole(role: unknown): boolean {
  return String(role || "").toUpperCase() === "AGENT";
}

export function isAgentCommissionAccount(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;
  const u = user as Record<string, unknown>;
  if (isMobileAgentRole(u.role)) return true;
  const roleU = String(u.role ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (roleU.includes("PARTNER")) return true;
  const pt = String(u.planType ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (pt.includes("AGENCY")) return true;
  if (u.isPartner === true || u.isAgency === true) return true;
  return false;
}

export function extractAgentCommissionPercent(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  for (const key of [
    "agentCommissionPercent",
    "agent_commission_percent",
    "commissionPercent",
  ]) {
    const parsed = parseAgentCommissionPercent(o[key]);
    if (parsed !== null && parsed >= 0) return parsed;
  }
  return null;
}

export type AgentCommissionDescribe = {
  percent: number;
  amount: number;
  percentLabel: string;
  amountLabel: string;
  isZero: boolean;
};

export function describeOfferAgentCommission(
  raw: unknown,
  priceRaw: unknown,
): AgentCommissionDescribe | null {
  if (!raw || typeof raw !== "object") return null;
  const percent = extractAgentCommissionPercent(raw);
  if (percent === null) return null;
  const isZero = isZeroCommissionPercent(percent);
  const priceNum = parseOfferNumeric(priceRaw ?? (raw as Record<string, unknown>).price);
  if (!isZero && (!Number.isFinite(priceNum) || priceNum <= 0)) return null;
  const amount = isZero ? 0 : computeAgentCommissionAmount(priceRaw ?? (raw as Record<string, unknown>).price, percent);
  return {
    percent,
    amount,
    percentLabel: formatPercentLabel(percent),
    amountLabel: isZero ? formatPlnAmount(0) : formatPlnAmount(amount),
    isZero,
  };
}

/** Tekst informacyjny na stronie oferty (kupujący). */
export function formatBuyerAgentCommissionLine(
  info: AgentCommissionDescribe,
  locale: "pl" | "en" = "pl",
): string {
  if (info.isZero) {
    return locale === "en"
      ? "No agent commission on this listing."
      : "Brak prowizji agenta przy tej ofercie.";
  }
  return locale === "en"
    ? `The listing price is the final gross amount (not increased). After the sale, the buyer pays ${info.amountLabel} (${info.percentLabel} of that price, max. 10%) as gross agent commission directly to the agent.`
    : `Cena ofertowa to ostateczna kwota brutto — nie jest podwyższana. Po transakcji kupujący z tej kwoty wypłaca agentowi ${info.amountLabel} (${info.percentLabel}, max. 10% ceny) jako prowizję brutto, bezpośrednio poza platformą.`;
}

export function resolveAgentCommissionPercentForSave(opts: {
  mode: AgentCommissionInputMode;
  percentRaw: unknown;
  amountRaw: unknown;
  priceRaw: unknown;
}): AgentCommissionValidation {
  if (opts.mode === "amount") {
    const synced = commissionAmountInputToPercent(opts.priceRaw, opts.amountRaw);
    if (synced === null) {
      return {
        ok: false,
        code: AGENT_COMMISSION_ERROR_CODES.INVALID_TYPE,
        message: "Podaj kwotę prowizji i cenę oferty.",
      };
    }
    return validateAgentCommissionPercent(synced.percent);
  }
  return validateAgentCommissionPercent(opts.percentRaw);
}
