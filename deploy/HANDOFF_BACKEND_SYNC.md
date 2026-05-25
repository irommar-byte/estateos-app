# Kontrakt EstateOS — backend vs aplikacja mobilna

Backend (**estateos.pl**) jest wdrażany z gita na VPS (`~/estateos`, branch **`recovery-local-snapshot`**). Kanoniczny workflow: **[VPS_DEPLOY_WORKFLOW.md](./VPS_DEPLOY_WORKFLOW.md)**. Ta strona to referencja kontraktu API dla agentów od aplikacji mobilnej.

## Backend (estateos.pl)

- **Kanoniczny URL wizytówki oferty (share / web):** `https://estateos.pl/o/<id>` — ten sam liczbowy `<id>` co w `/api/offers/<id>`.
- **Deep link (nawigacja w aplikacji):** `estateos://o/<id>` (`{offerId}` = ID z API).
- **Universal Links / App Links (ścieżki powiązane z aplikacją, zgodnie z backendem):** `/o/*`, `/oferta/*`, `/offer/*` — pliki: `https://estateos.pl/.well-known/apple-app-site-association`, `https://estateos.pl/.well-known/assetlinks.json` (generacja z ENV w `src/lib/wellKnownAppLinks.ts` po stronie Next).
- **Rejestracja push (POST):** `https://estateos.pl/api/notifications/device` — nagłówek `Authorization: Bearer <JWT>`, body JSON z `expoPushToken` itd.
- **Smoke test TLS (GET w Safari):** `https://estateos.pl/api/notifications/device` → JSON z `ok: true`
- **ENV na serwerze (bez placeholderów):** `APPLE_TEAM_ID`, `ANDROID_SHA256_CERT_FINGERPRINT`; opcjonalnie `IOS_BUNDLE_ID` / `ANDROID_PACKAGE_NAME` jeśli ≠ `pl.estateos.app`.

## Zadania w aplikacji

1. **Udostępnianie:** w treści kanoniczny link `https://estateos.pl/o/<id>` + linia promująca EstateOS / estateos.pl — utrzymuj spójnie (`offerShareUrls.ts`, `OfferDetail`).
2. **Push:** `usePushNotifications` — POST na powyższy URL z retry przy sieci; przy błędzie sieciowym można sprawdzić GET w Safari na ten sam endpoint.
3. **Deeplinki:** `applinks:estateos.pl` (iOS) oraz `intentFilters` dla `https://estateos.pl` z prefiksami `/o`, `/oferta`, `/offer` (Android) — zgodnie z AASA/assetlinks na domenie. Po otwarciu `https://estateos.pl/o/<id>` system może przekazać URL do aplikacji; w przeciwnym razie użytkownik zostaje na wizytówce (`offer-landing.html` + `/api/offers/<id>`).

## Teraz (ostatnio od backendu)

- **Deploy (2026-05-25):** VPS zsynchronizowany z `origin/recovery-local-snapshot`; workflow: `git pull` → `npm run deploy:server-only` (lub `deploy:prod` przy zmianie lockfile). Szczegóły: [VPS_DEPLOY_WORKFLOW.md](./VPS_DEPLOY_WORKFLOW.md). **Bez SCP.**
- **GET** na `/api/notifications/device` działa (smoke TLS: JSON `ok`). **Kontraktu POST nie zmieniamy** — aplikacja wysyła push tak jak dotąd.

<!-- Aktualizuj wyłącznie powyższą sekcję „Teraz”, gdy backend dopisze nowe ustalenia -->
