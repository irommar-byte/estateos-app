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
      message: `Poza zakresem: dozwolone 0 lub ${AGENT_COMMISSION_MIN_NONZERO}–${AGENT_COMMISSION_MAX}%.`,
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
