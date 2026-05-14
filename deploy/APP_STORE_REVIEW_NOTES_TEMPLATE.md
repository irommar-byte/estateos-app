# EstateOS™ — App Store Review Notes

Skopiuj poniższą treść do App Store Connect → „App Review Information" →
„Notes for Review". Uzupełnij pola w `<...>` swoimi danymi.

---

Hello App Review Team,

Thank you for reviewing EstateOS™. The app helps property owners and licensed
agents publish listings, while buyers can browse, save favourites, chat with
sellers in a secured "Dealroom" and arrange in-person viewings. All purchases
on iOS are made via Apple's In-App Purchase. No external payment links are
shown to users on iOS.

## 1) Test account

- Email: `<review-account-email>`
- Password: `<review-account-password>`
- Phone (already verified): `<+48 ... 9 digits>`
- Default role: `USER` (private seller). For Agent flow test see §6.

If the test account is locked or expired, please request a fresh one at
`support@estateos.pl` and we will provision within a few hours.

## 2) Main flows to verify

1. **Sign in** — open app → "Profil" tab → enter the credentials above.
2. **Browse offers** — switch to "Radar" tab. Map pins show approximate
   locations (privacy by design).
3. **Open offer details** — tap any pin or the card carousel at the bottom.
4. **Add to favourites** — heart icon in the top-right of the detail screen.
5. **Publish a new offer** — bottom plus button → 6-step wizard ("Dodaj
   ofertę") → review summary → publish. A first listing is free; subsequent
   listings can be unlocked with the in-app purchase (see §3).
6. **Dealroom chat** — open any offer where you're not the owner → "Wyślij
   propozycję" → opens chat with the seller.

## 3) In-App Purchase (Apple IAP only on iOS)

- **Product:** `pl.estateos.app.pakiet_plus_30d` — consumable, +1 listing
  slot valid for 30 days.
- **How to trigger:**
  - After publishing the first free listing, try to add a second one.
    A dialog suggests the purchase using the native App Store sheet.
  - Or open Profile → "Pakiet Plus" tile.
- **Restore Purchases:** Profile → "Zakupy i sklep" → "Przywróć zakupy".
- **No external payment:** on iOS we **never** show "buy on the website"
  links or external Stripe links. Stripe checkout is restricted to Android
  builds via `Platform.OS !== 'ios'` guards.

## 4) Account deletion (Guideline 5.1.1(v))

1. Open "Profil" tab.
2. Scroll to the very bottom — small grey link "usuń konto" below the app
   version number.
3. Enter the current password, accept the confirmation, tap "Usuń konto".
4. The account is permanently deleted on the backend (`DELETE
   /api/mobile/v1/user/me`) along with all the user's offers and chats.
   Passkey credentials are revoked and the local session is cleared.

## 5) User-Generated Content — Report & Block (Guideline 1.2)

The app has user-generated offers, in-app chat (Dealroom) and reviews.
The following content moderation mechanisms are available to every signed-in
user:

1. **Report an offer:** in the offer detail screen tap "⋯" (top-right) →
   "Zgłoś ofertę" → choose category (Spam, Fraud, Offensive, Hate speech,
   Adult content, Copyright, Other) → optional description → "Zgłoś".
   Confirmation: "Dziękujemy za zgłoszenie. Sprawdzimy w ciągu 24 godzin."
2. **Report a user:** open any Dealroom chat → "⋯" in the header → "Zgłoś
   użytkownika" → same category sheet.
3. **Block a user:** "⋯" in either screen → "Zablokuj". The blocked user's
   offers and chats disappear from the UI immediately and the user cannot
   contact you any more.
4. **Unblock a user:** Profile → "Pomoc i regulamin" → "Zablokowani
   użytkownicy" → "Odblokuj" next to the entry.
5. **EULA:** Profile → "Pomoc i regulamin" → "Regulamin" — describes zero
   tolerance for objectionable content and the moderation flow.

Reports are reviewed by our in-house team within 24 hours via the admin
panel (`/api/mobile/v1/admin/reports`) and via email alert to
`moderation@estateos.pl`. Confirmed violations result in offer takedown or
account suspension.

## 6) Agent role flow (optional)

Some accounts have role `AGENT` and can attach a commission to listings.
The commission is shown to the buyer as a transparent breakdown of the
listing price (always BRUTTO — VAT included; no hidden fees). The pin
colour for agent offers is orange on the radar.

To test agent flow, please request an agent test account at
`support@estateos.pl`.

## 7) Privacy & permissions

- **Location:** "When in use" only. We never request "Always" and never run
  background location updates.
- **Camera / Photos:** used only when adding photos to your own offer.
- **Face ID / Touch ID:** optional passwordless sign-in (Passkey / WebAuthn).
- **Calendar / Reminders:** optional, on user action when saving a viewing
  appointment.
- **Notifications:** functional only — radar matches, chat messages, offer
  status updates. No marketing pushes.
- **No third-party tracking:** no analytics, no advertising SDKs, no ATT
  prompt. `NSPrivacyTracking=false` in `PrivacyInfo.xcprivacy`.

## 8) URLs

- Production API: `https://estateos.pl`
- Privacy Policy: `https://estateos.pl/polityka-prywatnosci`
- Terms of Service: `https://estateos.pl/regulamin`
- Support: `support@estateos.pl`
- Marketing: `https://estateos.pl`
- Deep links: `estateos://o/<id>` and `https://estateos.pl/o/<id>`

## 9) Contact for review feedback

- Name: `<owner-name>`
- Email: `<owner-email>`
- Phone (urgent only): `<owner-phone>`

We monitor App Review Connect Resolution Center continuously and will
respond within a few hours.

Thank you,
EstateOS™ team

---
