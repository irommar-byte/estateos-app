/**
 * Rozróżnienie tożsamości na mapie / liście / etykietach:
 * - rola techniczna AGENT (biuro, companyName przy rejestracji) ≠ program partnerski.
 * - „Partner” w sensie produktu — osobna ścieżka (PARTNER / AGENCY / BROKER lub jawny flag).
 */

export function normalizeIdentityToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

/** Użytkownik z rolą AGENT w bazie (EstateOS Agent). */
export function isAgentRoleIdentity(role: unknown): boolean {
  return normalizeIdentityToken(role) === "AGENT";
}

/**
 * Tożsamość „partner programu” / agencyjny partner marketingowy — NIE wynika sama z roli AGENT.
 * Jawny `isPartner: true` z API nadal może włączyć partner chrome (np. umowy B2B).
 */
export function isPartnerIdentity(subject: {
  role?: unknown;
  isPartner?: boolean;
  userRole?: unknown;
}): boolean {
  if (subject.isPartner === true) return true;
  const tokens = [subject.role, subject.userRole].map(normalizeIdentityToken);
  return tokens.some((t) => t === "PARTNER" || t === "BROKER" || t === "AGENCY");
}
