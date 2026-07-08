# EstateOS tvOS

Native Apple TV client for EstateOS listings.

## Scope (MVP)

- Login with EstateOS account
- Latest offers rail
- Search offers
- Offer detail
- QR handoff to iPhone/web

## Generate Xcode project

```bash
cd tvOS/EstateOS
python3 generate_xcode_project.py
```

Then open:

- `tvOS/EstateOS/EstateOS.xcodeproj`

## App Store Connect pairing (iOS + tvOS)

To make users see both platforms under one EstateOS product:

1. Use consistent app name and metadata (`EstateOS`) for iOS and tvOS.
2. Create tvOS app record as the Apple TV platform variant for the same EstateOS product.
3. Upload iOS and tvOS builds to the same App Store Connect app listing.
4. Validate in TestFlight that EstateOS shows platform availability for iPhone and Apple TV.
