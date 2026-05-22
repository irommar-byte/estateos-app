# Backend: EstateOS™ CORE — metryki admin (live)

**Status produkcji:** wdrożone (`0a43beaa`, PM2 reload, smoke 21/21).

Aplikacja mobilna (Profil → Narzędzia Administratora → **EstateOS™ CORE**) odpytuje co **3 s** jeden z endpointów (pierwszy działający):

1. `GET /api/mobile/v1/admin/core/metrics` (**kanoniczny — używany w pierwszej kolejności**)
2. `GET /api/mobile/v1/admin/core/health`
3. `GET /api/admin/core/metrics`
4. `GET /api/admin/core/health`

**Auth:** `Authorization: Bearer <admin JWT>` — tylko rola `ADMIN`.

## Przykładowa odpowiedź

```json
{
  "success": true,
  "metrics": {
    "collectedAt": "2026-05-21T12:00:00.000Z",
    "host": "estateos-prod-01",
    "uptimeSec": 1048576,
    "cpu": {
      "percent": 42.5,
      "cores": 4,
      "load1": 0.38,
      "load5": 0.41,
      "load15": 0.35
    },
    "memory": {
      "usedBytes": 8589934592,
      "totalBytes": 17179869184,
      "percent": 50.0
    },
    "disk": {
      "usedBytes": 137438953472,
      "totalBytes": 274877906944,
      "percent": 50.0
    },
    "process": {
      "rssBytes": 440401920,
      "heapUsedBytes": 188743680,
      "heapTotalBytes": 268435456
    },
    "network": {
      "requestsPerMin": 128,
      "activeConnections": 34
    },
    "database": {
      "poolActive": 6,
      "poolMax": 20,
      "latencyMs": 12
    },
    "app": {
      "offersPending": 3,
      "activeUsers": 24,
      "pushQueueDepth": 5,
      "radarPushActive": 18
    }
  }
}
```

## Implementacja (Node / Linux)

- **CPU:** `os.loadavg()` + estymacja % (lub `/proc/stat` delta).
- **RAM:** `os.totalmem()` / `os.freemem()`.
- **Dysk:** `df` na wolumenie aplikacji / uploadów.
- **Process:** `process.memoryUsage()`, `process.uptime()`.
- **App:** zapytania SQL (COUNT pending offers, aktywni użytkownicy, kolejka push) — opcjonalnie.

- `network.requestsPerMin` / `activeConnections` mogą być `0` (brak licznika middleware) — UI pokazuje `0`.
- W **EstateOS™ CORE** (modal admin) podgląd jest **wyłączony** — tylko żywe metryki z API (`allowPreviewFallback: false`).
- `401` / `403` — komunikat błędu (wygasła sesja / brak roli ADMIN).

## Sterowanie start/stop (wdrożone)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| POST | `/api/mobile/v1/admin/core/start` | `pm2 start nieruchomosci` (w tle) |
| POST | `/api/mobile/v1/admin/core/stop` | `pm2 stop nieruchomosci` (w tle) |
| POST | `/api/admin/core/start` | alias |
| POST | `/api/admin/core/stop` | alias |
| GET | `/api/mobile/v1/admin/core/logs?lines=80` | Ostatnie logi PM2 (live) |
| GET | `/api/admin/core/logs` | alias logów |

**Auth:** Bearer + rola `ADMIN`.  
**Env serwera:** `ADMIN_CORE_CONTROL_ENABLED=1` (wymagane), opcjonalnie `ADMIN_CORE_PM2_NAME=nieruchomosci`.

**Start (zielony ONLINE):** zawsze czyści flagę OFFLINE i wykonuje `pm2 start` / `restart` / `reload` (PM2 nie jest zabijany przy OFFLINE — API musi odpowiadać).

Odpowiedź:

```json
{ "success": true, "state": "starting", "message": "Uruchamianie nieruchomosci w tle — ONLINE po powrocie metryk." }
```

Implementacja: `src/lib/adminCoreControl.ts` na serwerze `~/estateos`.  
Aplikacja: `ADMIN_CORE_SERVER_CONTROL_ENABLED = true`, diody OFFLINE/ONLINE = stop/start z potwierdzeniem.
