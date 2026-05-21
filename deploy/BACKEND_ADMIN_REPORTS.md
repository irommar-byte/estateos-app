# Backend — Admin panel zgłoszeń UGC

**Status:** wdrożone na produkcji (`estateos.pl`).

## Endpointy (wymagają JWT + roli `ADMIN`)

### `GET /api/mobile/v1/admin/reports`

Query:

| Param | Wartości |
|-------|----------|
| `status` | `PENDING` \| `IN_REVIEW` \| `ACTIONED` \| `DISMISSED` \| `ARCHIVED` (ACTIONED+DISMISSED) \| `ALL` |
| `targetType` | `OFFER` \| `USER` \| `ALL` |

Response:

```json
{
  "success": true,
  "reports": [ { "id", "status", "category", "reason", "adminNote", "reporter", "reportedUser", "offer", ... } ],
  "counts": { "pending", "inReview", "actioned", "dismissed", "total" }
}
```

### `PATCH /api/mobile/v1/admin/reports/:id`

Body: `{ "status": "PENDING"|"IN_REVIEW"|"ACTIONED"|"DISMISSED", "adminNote": "..." }`

## Baza

Tabela `MobileContentReport` + kolumny `adminNote`, `reviewerId` (migracja przez `ensureAdminReportColumns()`).

## Klient mobilny

- `src/components/AdminContentReportsModal.tsx`
- `src/services/adminReportsService.ts`
- Profil → **Narzędzia Administratora** → **Zgłoszenia UGC**
