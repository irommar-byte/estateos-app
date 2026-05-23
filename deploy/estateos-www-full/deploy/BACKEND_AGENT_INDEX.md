# Pakiet „AGENT” dla backendu — spis

Czytaj w kolejności:

1. **[BACKEND_AGENT_ROLE_OVERVIEW.md](./BACKEND_AGENT_ROLE_OVERVIEW.md)** — czym jest AGENT vs partner / private; brak rozliczeń prowizji w platformie.
2. **Kontrakty API**
   - [BACKEND_AGENT_REGISTRATION_API.md](./BACKEND_AGENT_REGISTRATION_API.md)
   - [BACKEND_AGENT_PROFILE_EDIT_API.md](./BACKEND_AGENT_PROFILE_EDIT_API.md)
   - [BACKEND_AGENT_OFFER_API.md](./BACKEND_AGENT_OFFER_API.md)
   - [BACKEND_AGENT_ERROR_CODES.md](./BACKEND_AGENT_ERROR_CODES.md)
3. **Źródło prawdy (TS, współdzielone z mobile)**
   - `src/lib/agentCommission.ts` — limity i walidacja procentu.
   - `src/utils/partnerIdentity.ts` — rozpoznanie roli AGENT vs tożsamość „partner” na mapie / UI.

---

## Wiadomość do zespołu backendu (do wklejenia)

Mamy mobilną rolę **AGENT** (biuro, **`companyName`** przy rejestracji). Oferty agenta mogą mieć **`agentCommissionPercent`** (**0%** albo **0,5–10%**, krok **0,25**) — wyłącznie informacja na liście / szczegółach; **nie pobieramy prowizji** w aplikacji ani jej nie rozliczamy po stronie serwera.

Prosimy o implementację zgodną z plikami **`BACKEND_AGENT_*.md`** w `deploy/` oraz walidację **zsynchronizowaną** z `src/lib/agentCommission.ts`. Rola w bazie ma zostać **`AGENT`** (`Role.AGENT`); **bez** mapowania konta agenta na **PARTNER** w modelu uprawnień / partner programu, chyba że macie osobny, jawny mechanizm biznesowy (`isPartner` itd.).
