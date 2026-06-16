# Android — artefakty EAS (versionCode 50)

Pliki binarne **nie są w git** — wrzucaj na serwer do `public/downloads/`.

| Profil | Build ID | Plik na serwerze | URL EAS |
|--------|----------|------------------|---------|
| preview-android (APK, beta www) | `989fd62e-3653-4ecb-9636-76b2d554a978` | `public/downloads/estateos-android.apk` | https://expo.dev/artifacts/eas/iDoRxQSDif0s8j27VBhEtwYXyCjJOEPg96eJ9a75iPk.apk |
| production-android (AAB, Play) | `74340222-263f-444e-bb3e-0f49f040e629` | `public/downloads/estateos-android.aab` | https://expo.dev/artifacts/eas/3IsYnWUgSbINmSX4CEX_j9-20-AGOSoYj3likW_Dyfs.aab |

## WWW

- Beta (instalacja): `/downloads/estateos-android.apk` → badge Google Play + „Beta”
- AAB (Play Console): `/downloads/estateos-android.aab`

## Deploy po nowym buildzie

```bash
# APK (preview-android)
curl -L -o /tmp/estateos-android.apk "<Application Archive URL>"
scp /tmp/estateos-android.apk estateos:/home/rommar/estateos/public/downloads/

# opcjonalnie AAB (production-android)
scp application-*.aab estateos:/home/rommar/estateos/public/downloads/estateos-android.aab

# kod www
rsync … && ssh estateos 'cd ~/estateos && npm run deploy:server-only'
```
