# Radar Live Activity (iOS) - Premium rollout

## Status in this branch

- App-side contract and runtime sync are implemented:
  - `src/contracts/radarLiveActivityContract.ts`
  - `src/services/radarLiveActivityService.ts`
  - `src/screens/RadarHomeScreen.tsx` (auto sync while Radar is active)
  - `src/store/useAuthStore.ts` (sync on restore, stop on logout)
- Native iOS bridge is implemented in app target:
  - `ios/EstateOS/RadarLiveActivityModule.swift`
  - `ios/EstateOS/RadarLiveActivityModuleBridge.m`
  - `ios/EstateOS.xcodeproj/project.pbxproj` updated (sources + file refs)
- iOS plist flags are enabled in `app.json`:
  - `NSSupportsLiveActivities=true`
  - `NSSupportsLiveActivitiesFrequentUpdates=true`
- If native ActivityKit bridge is not present yet, app uses a safe local-notification fallback:
  - "Radar aktywny"
  - "Monitoring rynku trwa ..."

## Required native iOS step (single ecosystem)

This repository is Expo managed (no `ios/` checked in), so ActivityKit display in Dynamic Island requires prebuild + widget extension:

1. Generate iOS project:
   - `npx expo prebuild --platform ios`
2. Add Widget Extension target in Xcode (for Live Activity UI).
3. Implement ActivityKit attributes and views in extension target:
   - Lock Screen view
   - Dynamic Island compact/minimal/expanded
4. Native bridge already added: `RadarLiveActivityModule` with methods:
   - `startMonitoring(snapshotJson)`
   - `updateMonitoring(snapshotJson)`
   - `stopMonitoring()`
5. Ensure app group / signing are consistent with:
   - Team ID: `NW3YW69KL9`
   - Bundle ID: `pl.estateos.app`

After bridge exists, JS automatically switches from fallback notification to true Live Activity.

## Backend payload contract for push updates

Canonical payload from backend to mobile:

```json
{
  "type": "RADAR_LIVE_ACTIVITY_UPDATE",
  "radar": {
    "enabled": true,
    "transactionType": "SELL",
    "city": "Warszawa",
    "minMatchThreshold": 78,
    "activeMatchesCount": 24,
    "updatedAtIso": "2026-05-07T10:00:00.000Z"
  }
}
```

Rules:
- `enabled=false` => stop activity
- `transactionType` accepted: `SELL|RENT`
- `minMatchThreshold` clamped to `50..100`
- `activeMatchesCount` must be non-negative integer

## Validation commands

```bash
npm run test:contracts
npx expo-doctor
```

For iOS build after native extension is added:

```bash
npx expo prebuild --platform ios
npx expo run:ios
npm run eas:ios
```
