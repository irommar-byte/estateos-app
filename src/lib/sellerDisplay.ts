/** Wyświetlanie sprzedawcy / agenta na ofertach i w panelu admina. */

export function isAgentOrAgencySeller(userLike: unknown): boolean {
  if (!userLike || typeof userLike !== "object") return false;
  const u = userLike as Record<string, unknown>;
  const role = String(u.role ?? "").toUpperCase();
  if (role === "AGENT") return true;
  const plan = String(u.planType ?? u.buyerType ?? u.type ?? "").toUpperCase();
  return plan === "AGENCY" || plan === "AGENT";
}

/** Główna etykieta na ofercie / mapie — dla agenta: nazwa biura, inaczej imię i nazwisko. */
export function resolveSellerDisplayName(userLike: unknown, fallback = ""): string {
  if (!userLike || typeof userLike !== "object") return fallback;
  const u = userLike as Record<string, unknown>;
  if (isAgentOrAgencySeller(u)) {
    const company = String(u.companyName ?? u.agencyName ?? "").trim();
    if (company) return company;
  }
  const person = String(u.name ?? u.contactName ?? "").trim();
  return person || fallback;
}

/** Nazwa biura z rejestracji agenta — wyłącznie companyName (bez imienia i nazwiska). */
export function resolveServicingCompanyName(
  userLike: unknown,
  offerAgencyName?: unknown,
): string | null {
  if (!isAgentOrAgencySeller(userLike)) return null;
  const u = (userLike && typeof userLike === "object" ? userLike : {}) as Record<string, unknown>;
  const company = String(u.companyName ?? u.agencyName ?? offerAgencyName ?? "").trim();
  return company || null;
}

/** Imię i nazwisko agenta (podpis pod nazwą firmy). */
export function resolveSellerPersonName(userLike: unknown): string | null {
  if (!userLike || typeof userLike !== "object") return null;
  const u = userLike as Record<string, unknown>;
  if (!isAgentOrAgencySeller(u)) return null;
  const person = String(u.name ?? u.contactName ?? "").trim();
  return person || null;
}

/** Nagłówek profilu: dla agenta nazwa biura + opcjonalnie osoba, inaczej imię i nazwisko. */
export function resolveProfileHeadlines(userLike: unknown): { primary: string; secondary?: string } {
  if (!userLike || typeof userLike !== "object") {
    return { primary: "Użytkownik" };
  }
  const u = userLike as Record<string, unknown>;
  const emailFallback = String(u.email ?? "")
    .trim()
    .split("@")[0];
  const person = String(u.name ?? u.contactName ?? emailFallback ?? "").trim() || "Użytkownik";

  if (isAgentOrAgencySeller(u)) {
    const company = String(u.companyName ?? u.agencyName ?? "").trim();
    if (company) {
      return {
        primary: company,
        secondary: person !== company ? person : undefined,
      };
    }
  }

  return { primary: person };
}

/** Etykieta kontrahenta w czacie, opiniach i dealroomie. */
export function resolveCounterpartyLabel(userLike: unknown, fallback = "Kontrahent"): string {
  const { primary } = resolveProfileHeadlines(userLike);
  return primary || fallback;
}
