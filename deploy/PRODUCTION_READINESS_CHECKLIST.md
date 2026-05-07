# EstateOS Mobile Production Readiness Checklist

This checklist is a release gate for TestFlight and production rollout.

## 1) Auth E2E

- [ ] Email + password login works for valid credentials.
- [ ] Invalid credentials show a user-facing error alert (no silent fail).
- [ ] Passkey login works on iOS physical device with saved credential.
- [ ] Passkey login handles "no credentials" with recovery hint.
- [ ] Logout clears `mobile_token` and `user_data`.
- [ ] Cold start restore session rehydrates user and token from storage.
- [ ] Token refresh (`GET /api/mobile/v1/auth`) updates user profile safely.

### Passkey backend prerequisites

- [ ] AASA contains real app id `NW3YW69KL9.pl.estateos.app` (no placeholders).
- [ ] AASA served with 200 on:
  - [ ] `/.well-known/apple-app-site-association`
  - [ ] `/apple-app-site-association`
- [ ] `webcredentials.apps` includes `NW3YW69KL9.pl.estateos.app`.

## 2) Push / Deeplink E2E

- [ ] Notification click with `target=dealroom` opens `DealroomChat`.
- [ ] Notification click with `targetType=DEAL` opens `DealroomChat`.
- [ ] Notification click with `dealId` opens `DealroomChat`.
- [ ] Notification click with only `offerId` falls back to `OfferDetail`.
- [ ] Legacy payload formats are still parsed correctly.
- [ ] Deep links work:
  - [ ] `estateos://o/:id`
  - [ ] `https://estateos.pl/o/:id`

## 3) Dealroom Finalization / Review E2E

- [ ] Finalization is allowed only when `deal.status=AGREED` and `acceptedBidId` exists.
- [ ] Owner acceptance produces finalized transaction state in chat UI.
- [ ] Post-finalization action buttons are disabled.
- [ ] Review submit uses only `POST /api/reviews`.
- [ ] Review payload shape is canonical:
  - [ ] `dealId`
  - [ ] `targetId`
  - [ ] `rating` 1..5
  - [ ] `review` optional, <= 1000
  - [ ] `senderId` optional/meta only
- [ ] Finalized deals appear in "Sfinalizowane" list section.

## 4) Radar / Favorites Parity Smoke

- [ ] App sends canonical radar DTO field names only.
- [ ] DTO uses `selectedDistricts` (never `districts` or `favoriteDistricts` on input).
- [ ] No `favoritesNotify*` fields are sent to backend.
- [ ] Favorites mode is UI-only and maps to same canonical DTO.
- [ ] Search behavior is scoped correctly in favorites mode.

## 5) TestFlight Release Checklist

- [ ] `npm run test:contracts` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run lint` has no new warnings in edited files.
- [ ] iPhone small screen smoke (SE/mini class).
- [ ] iPhone standard screen smoke (6.1").
- [ ] iPhone large screen smoke (Pro Max class).
- [ ] iPad smoke for major flows (auth, radar, dealroom).
- [ ] Dark and light theme sanity checks.
- [ ] Offline/poor-network sanity for auth and passkey timeouts.

## Mandatory backend confirmation before passkey sign-off

- [ ] Confirm deployed AASA content in production.
- [ ] Confirm passkey endpoints return expected `publicKey` and `sessionId` on start.
- [ ] Confirm login finish returns `{ token, user }`.
- [ ] Confirm register verify returns success for created credentials.
