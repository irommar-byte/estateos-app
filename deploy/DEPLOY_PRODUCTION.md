# Produkcja WWW (canonical: estateos-recovery-deploy)

```bash
cd /home/rommar/estateos && git pull --ff-only origin recovery-local-snapshot && ./scripts/deploy-prod.sh && npm run smoke:postdeploy
```

Repozytorium źródłowe: `github.com/irommar-byte/estateos-app`, gałąź `recovery-local-snapshot`.
