# Kody błędów — agent / rejestracja / prowizja

W odpowiedziach **400** (walidacja) zalecamy payload:

```json
{
  "success": false,
  "code": "AGENT_COMPANY_NAME_REQUIRED",
  "message": "Czytelny opis po polsku (dla logów / wsparcia)."
}
```

Mobile może mapować wyłącznie po **`code`**.

## Rejestracja (`POST /api/register`)

| `code` | Kiedy |
|--------|--------|
| `AGENT_COMPANY_NAME_REQUIRED` | `role === "AGENT"` i brak / pusty `companyName` po trim. |
| `AGENT_ROLE_INVALID` | `role` nieobsługiwany (np. literówka). |
| `EMAIL_REQUIRED` / `EMAIL_TAKEN` | (już istniejące komunikaty — opcjonalna standaryzacja) |
| `PHONE_TAKEN` | Numer zajęty. |

## Prowizja oferty (`agentCommissionPercent`)

Zgodne z `src/lib/agentCommission.ts` (`AGENT_COMMISSION_ERROR_CODES`):

| `code` | Kiedy |
|--------|--------|
| `AGENT_COMMISSION_INVALID_TYPE` | Nie da się sparsować do liczby. |
| `AGENT_COMMISSION_OUT_OF_RANGE` | Poza `{0} ∪ [0,5; 10]`. |
| `AGENT_COMMISSION_INVALID_STEP` | W zakresie, ale nie jest wielokrotnością **0,25**. |

## Profil (`PATCH` profilu)

| `code` | Kiedy |
|--------|--------|
| `AGENT_COMPANY_NAME_REQUIRED` | Agent zapisuje profil bez wymaganego `companyName` (jeśli polityka wymaga). |

## Uwagi

- Zachowajcie **stabilne** stringi `code` — zmiana łamie mapowanie w aplikacji.
- HTTP **422 Unprocessable Entity** jest alternatywą dla walidacji — wtedy też przekazujcie `code`.
