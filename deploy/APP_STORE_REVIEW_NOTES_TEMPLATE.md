# EstateOS - App Store Review Notes Template

Skopiuj ten szablon do App Store Connect -> "Notes for Review" i uzupelnij pola.

---

Hello App Review Team,

Thank you for reviewing EstateOS.

## 1) Test account

- Email: `<review-account-email>`
- Password: `<review-account-password>`
- 2FA: `<if applicable>`

## 2) Main flows to verify

1. Login:
   - Open app -> Profile tab -> sign in with credentials above.
2. Offer publishing:
   - Main flow: add offer -> complete summary -> publish.
3. Account deletion:
   - Profile -> bottom link "usun konto" -> confirm with password.

## 3) In-app purchase flow (Pakiet Plus)

- Product ID: `pl.estateos.app.pakiet_plus_30d`
- Purpose: additional listing slot for publication/reactivation scenarios.
- On iOS, additional listing quota flow uses native App Store purchase sheet.

## 4) Clarification for PRO messaging on iOS

- In selected contexts, app may show informational message "Pakiet PRO wkrotce".
- This is informational only and does not provide an external checkout inside iOS flow.

## 5) Backend/API domain

- Production API: `https://estateos.pl`
- Deep links:
  - `estateos://o/<id>`
  - `https://estateos.pl/o/<id>`

If you need a fresh account or additional test data, please contact:

- Name: `<owner-name>`
- Email: `<owner-email>`

Thank you.

---
