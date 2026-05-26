# Produkcja EstateOS — jedna komenda

Na serwerze VPS (katalog aplikacji: `/home/rommar/estateos`):

```bash
cd /home/rommar/estateos && git pull --ff-only origin recovery-local-snapshot && ./scripts/deploy-prod.sh && npm run smoke:postdeploy
```

To jest pełny cykl: **pull → build/deploy → smoke test**.

Opcjonalnie zdalny smoke (z laptopa, gdy serwer już wdrożony):

```bash
SMOKE_BASE_URL=https://estateos.pl npm run smoke:postdeploy
```
