# Backend: czym jest rola `AGENT` (EstateOS™ mobile)

Dokument dla zespołu backendu — **jedna strona kontekstu**, zanim wejdziecie w szczegóły endpointów. Szczegółowe kontrakty są już w:

- `BACKEND_AGENT_REGISTRATION_API.md` — rejestracja (`POST /api/register`, `companyName`)
- `BACKEND_AGENT_PROFILE_EDIT_API.md` — edycja profilu agenta
- `BACKEND_AGENT_OFFER_API.md` — oferty z prowizją agenta
- `BACKEND_AGENT_ERROR_CODES.md` — kody błędów walidacji

---

## Jedno zdanie

**`AGENT`** to użytkownik mobilny reprezentujący **biuro / agencję nieruchomości** (pośrednik zawodowy), który wystawia oferty w aplikacji i może przy ofercie podać **deklarowaną prowizję procentową** (informacyjnie dla kupującego; rozliczenie **poza platformą**, bezpośrednio z agentem).

To **nie** jest „bot AI”, **nie** jest automatycznym skanerem rynku i **nie** jest synonimem słowa „agent” w sensie marketingowym.

---

## Trzy role w mobile (nie mylić)

| Rola | Kto to | Rejestracja mobile | Oferty |
|------|--------|--------------------|--------|
| **`PRIVATE`** | osoba prywatna | tak | bez prowizji agenta w sensie pośrednika |
| **`AGENT`** | pośrednik / biuro | tak, wymaga **`companyName`** | może ustawić `agentCommissionPercent` (0% lub 0,5–10%) |
| **`PARTNER`** | partner komercyjny EstateOS™ (legacy WWW) | **nie** z głównej ścieżki mobile jak `AGENT` | traktowany w UI częściowo podobnie do agenta (pinezka „partner”), ale **to osobny typ konta** |

W kodzie mobile **`AGENT` jest funkcjonalnie „jak partner”** dla mapy / pinów (`isPartnerIdentity` obejmuje `AGENT`), ale **etykieta i rejestracja** są rozdzielone (`isAgentRoleIdentity` → plakietka „Agent EstateOS™” zamiast „Partner EstateOS™”). Backend powinien **trzymać `role` jako źródło prawdy** i nie mapować `AGENT` → `PARTNER` w bazie.

---

## Co backend musi utrwalać i zwracać

1. **`user.role === 'AGENT'`** (string, zwykle uppercase po normalizacji).
2. **`companyName`** — nazwa biura (wymagane przy rejestracji roli `AGENT` w mobile).
3. Przy ofercie od agenta: pole prowizji zgodne z kontraktem w `BACKEND_AGENT_OFFER_API.md` (np. procent jako liczba / string — jak ustalicie w API; mobile waliduje 0 lub 0,5–10 zgodnie z `src/lib/agentCommission.ts`).

---

## Czego backend **nie** robi w imieniu aplikacji

- Nie pobiera ani nie rozlicza prowizji — aplikacja tylko **pokazuje** procent i wyliczoną kwotę informacyjnie.
- Nie zmienia ceny oferty dla kupującego — cena oferty jest **tą samą** co u prywatnego; adnotacja tłumaczy udział prowizji w cenie.

---

## Słowniczek (żeby nie było nieporozumień)

- **Agent (AGENT)** — konto pośrednika w aplikacji mobilnej.
- **Radar** — funkcja mapy / powiadomień, **niezależna** od roli AGENT (wszyscy użytkownicy).
- **Partner (PARTNER / AGENCY / BROKER)** — kontekst legacy i WWW; mobile może wyświetlać podobne oznaczenia, ale rejestracja **`AGENT`** jest osobną ścieżką.

Jeśli coś w API ma się nazywać „agent” w sensie technicznym, proszę rozróżniać **`AGENT` (rola użytkownika)** od innych znaczeń słowa „agent” w dokumentacji produktowej.
