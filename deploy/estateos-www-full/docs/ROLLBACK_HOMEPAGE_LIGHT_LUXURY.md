# Rollback — homepage light luxury

## Snapshot

| Branch | Purpose |
|--------|---------|
| `restore/homepage-pre-light-luxury` | Stan **przed** redesignem (commit bazowy) |
| `experiment/homepage-light-luxury` | Praca nad redesignem |

Bazowy commit: zobacz `git log -1 --oneline restore/homepage-pre-light-luxury`.

## Szybkie przywrócenie (lokalnie)

```bash
cd /Users/marian/estateos-recovery-deploy
git switch restore/homepage-pre-light-luxury
# albo wróć na produkcyjną gałąź bez redesignu:
git switch recovery-local-snapshot
```

Po merge redesignu na `recovery-local-snapshot`:

```bash
git revert <sha-commitów-redesignu>
# lub
git switch restore/homepage-pre-light-luxury
# i deploy tej gałęzi wg AGENT_GIT_DEPLOY_PLAYBOOK
```

WIP schowany przed startem: `git stash list` → `wip-before-homepage-light-luxury`.

## Pliki objęte redesignem

- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx` (gate floaterów na `/`)
- `src/components/hero3d/HeroDepthEffect.tsx`
- `src/components/layout/Navbar.tsx`
- `src/components/layout/EcosystemLuxurySwitch.tsx` (nowy)
- `src/components/layout/Footer.tsx`
- `src/components/layout/FloatingPreferencesDock.tsx`
- `src/components/home/MarketPulseBar.tsx`
- `src/components/home/GlobalStats.tsx`
- `src/components/home/HomeLiveStrip.tsx` (nowy, merge pulse+stats)
- `src/components/home/EstateOsGuidePanel.tsx`
- `src/components/home/FeaturedGallery.tsx`
- `src/components/home/FeaturedCarsGallery.tsx`
- `src/components/home/RadarLiveCounter.tsx`
- `src/components/home/DiscoveryPulse.tsx`
- `src/components/ecosystem/EcosystemVerticalTransition.tsx`
- `src/components/ecosystem/EcosystemAmbientBackground.tsx`
- `src/i18n/dictionaries.ts`
- `src/i18n/dictionaryUk.ts`
- `docs/ROLLBACK_HOMEPAGE_LIGHT_LUXURY.md`

## Deploy

**Nie deployuj** redesignu na VPS, dopóki wygląd nie zostanie zaakceptowany lokalnie / na preview.
