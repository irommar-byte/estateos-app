# Kontrakt EstateOS — backend vs aplikacja mobilna

**Deploy na produkcję:** wyłącznie według **[VPS_DEPLOY_WORKFLOW.md](./VPS_DEPLOY_WORKFLOW.md)** (Git → VPS, branch `recovery-local-snapshot`).

Poniżej: kontrakt API i zadania po stronie aplikacji mobilnej — bez duplikowania procedury deploy.

## Backend (estateos.pl) — kontrakt

- **Kanoniczny URL wizytówki oferty (share / web):** `https://estateos.pl/o/<id>` — ten sam liczbowy `<id>` co w `/api/offers/<id>`.
- **Deep link (nawigacja w aplikacji):** `estateos://o/<id>` (`{offerId}` = ID z API).
- **Universal Links / App Links:** `/o/*`, `/oferta/*`, `/offer/*` — `https://estateos.pl/.well-known/apple-app-site-association`, `https://estateos.pl/.well-known/assetlinks.json` (generacja z ENV w `src/lib/wellKnownAppLinks.ts`).
- **Rejestracja push (POST):** `https://estateos.pl/api/notifications/device` — `Authorization: Bearer <JWT>`, body z `expoPushToken` itd.
- **Smoke test TLS (GET):** `https://estateos.pl/api/notifications/device` → JSON `ok: true`
- **ENV na serwerze (nie w repo):** `APPLE_TEAM_ID`, `ANDROID_SHA256_CERT_FINGERPRINT`; opcjonalnie `IOS_BUNDLE_ID` / `ANDROID_PACKAGE_NAME` jeśli ≠ `pl.estateos.app`.

## Zadania w aplikacji mobilnej

1. **Udostępnianie:** kanoniczny link `https://estateos.pl/o/<id>` + promocja EstateOS (`offerShareUrls.ts`, `OfferDetail`).
2. **Push:** `usePushNotifications` — POST na endpoint powyżej z retry; kontraktu POST nie zmieniamy bez uzgodnienia.
3. **Deeplinki:** `applinks:estateos.pl` (iOS), `intentFilters` dla `https://estateos.pl` z `/o`, `/oferta`, `/offer` (Android) — zgodnie z AASA/assetlinks na domenie.

## Teraz (ostatnio od backendu)

- **GET** `/api/notifications/device` — smoke TLS OK (`ok: true`).

<!-- Aktualizuj wyłącznie powyższą sekcję „Teraz”, gdy backend dopisze nowe ustalenia API -->
