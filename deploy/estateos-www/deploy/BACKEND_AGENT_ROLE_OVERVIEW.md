# EstateOS — rola **AGENT** (kontekst dla backendu)

## Czym jest AGENT

**AGENT** to rola konta w ekosystemie EstateOS dla **licencjonowanego pośrednika / biura**, który publikuje oferty w imieniu klientów. W onboarding mobilnym agent podaje **nazwę biura** (`companyName`); konto jest rozliczane **poza aplikacją** — platforma **nie pobiera ani nie rozlicza prowizji** od transakcji.

## Różnice semantyczne

| Pojęcie | Znaczenie |
|--------|-----------|
| **PRIVATE / USER** | Sprzedający prywatny; brak obowiązku `companyName` w kontekście agenta. |
| **AGENT** | Pośrednik z biurem; w bazie `Role.AGENT`; **nie** jest automatycznie „partnerem programu”. |
| **PARTNER** (marketing / program) | Osobna ścieżka umowna; **nie mapujemy** roli `AGENT` na `PARTNER` w danych użytkownika. Jawne flagi partnera (`isPartner` itd.) — tylko jeśli biznes je ustawia osobno. |

## Prowizja

- **Informacja dla kupującego** na liście / szczegółach oferty (np. procent od ceny oferty).
- **Brak** rozliczeń, faktur i escrow prowizji po stronie backendu — rozliczenia **poza platformą**.

## Powiązane dokumenty

- `BACKEND_AGENT_REGISTRATION_API.md` — rejestracja z `role: "AGENT"` + `companyName`.
- `BACKEND_AGENT_OFFER_API.md` — pole oferty `agentCommissionPercent`.
- `src/lib/agentCommission.ts` — limity walidacji (źródło prawdy wspólne z mobile).
