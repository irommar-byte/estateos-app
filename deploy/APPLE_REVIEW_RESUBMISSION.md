# Apple Review Resubmission Notes

## Rejection Items Fixed

### Guideline 5.1.1(iv) - Location Permission

Fix in app binary:

- Removed the custom pre-permission location dialog from `src/screens/RadarHomeScreen.tsx`.
- The app no longer shows a custom message with allow/deny wording before the iOS location prompt.
- The iOS system location permission dialog is shown directly when Radar needs location.
- If the user denies location, the app remains usable and shows offers without GPS sorting.

Reviewer-facing explanation:

```text
Location permission update:
We removed the custom pre-permission location prompt. The app now presents the native iOS location permission dialog directly when location is needed for Radar. If location permission is denied, the app remains usable and continues to show offers without GPS-based sorting.
```

### Guideline 2.1(b) - In-App Purchase Product Not Submitted

Required App Store Connect action:

1. Open App Store Connect.
2. Go to the app `EstateOS`.
3. Open `Features` -> `In-App Purchases`.
4. Open product ID:
   - `pl.estateos.app.pakiet_plus_30d`
5. Complete all required metadata:
   - Reference Name: `Pakiet Plus 30d`
   - Product ID: `pl.estateos.app.pakiet_plus_30d`
   - Type: must match the product currently used in the app/backend
   - Localized Display Name: `Pakiet Plus`
   - Localized Description: `Jednorazowy zakup pozwalający dodać jedną dodatkową nową ofertę na 30 dni.`
   - Price: select the active price tier
   - App Review Screenshot: upload a screenshot showing the purchase UI in the app
6. Add this In-App Purchase to the app version being submitted.
7. Submit the IAP together with the new binary.

Important:

- Apple explicitly said the IAP product was not submitted for review.
- A new binary is required with the corrected location flow.
- The IAP must be attached to the same version submission, not left only as an inactive product.

### Guideline 2.1 - Demo Account With Expired Purchase State

Add this in `App Review Information`:

```text
Demo account:
Username: <DEMO_EMAIL>
Password: <DEMO_PASSWORD>

This account is configured without an available Pakiet Plus additional publication so App Review can test the complete purchase flow.

Steps for review:
1. Log in with the demo account above.
2. Open Profile.
3. In "Zakupy i sklep", use "Przywróć zakupy" to test restore behavior.
4. To test purchasing, start the Pakiet Plus purchase flow from the offer publishing limit screen.

The app uses the following In-App Purchase product:
Product ID: pl.estateos.app.pakiet_plus_30d
```

Backend/account requirement:

- The demo user must exist on production.
- The demo user must be able to log in with email/password.
- The demo user must have no available additional Pakiet Plus publication before the purchase test.
- Pakiet Plus is consumable: one purchase allows one additional 30-day publication. It can publish a new listing or restore an ended listing as a new 30-day publication. It does not extend active listings and is not a subscription/account plan.

## Required New Binary

Use a new iOS build number greater than the rejected build `22`.

Current target build number in `app.json`:

```text
23
```

Build and submit:

```bash
npx tsc --noEmit
npm run eas:ios
npm run eas:ios:submit
```

or:

```bash
npm run eas:ios:all
```

## Final App Review Reply

Reply to Apple in App Store Connect:

```text
Hello,

Thank you for the review.

We have addressed the reported issues in the new binary:

1. Location permission:
We removed the custom pre-permission location dialog. The app now presents the native iOS location permission prompt directly when location is needed, and the app remains usable if permission is denied.

2. In-App Purchase:
The In-App Purchase product `pl.estateos.app.pakiet_plus_30d` has been completed in App Store Connect and submitted with this app version.

3. Demo account:
We added a demo account without an available Pakiet Plus additional publication in the App Review Information section so the full purchase flow can be reviewed.

Thank you.
```
