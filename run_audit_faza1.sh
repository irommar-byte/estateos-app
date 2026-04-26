#!/bin/bash
REPORT="audit_report_faza1.txt"
echo "=== START AUDYTU FAZA 1: ŚRODOWISKO I BEZPIECZEŃSTWO ===" > $REPORT

echo -e "\n[1] BŁĘDY RUNTIME PM2 (Ostatnie 50 linii error logu):" >> $REPORT
pm2 logs nieruchomosci --lines 50 --nostream --err >> $REPORT 2>&1

echo -e "\n[2] BEZPIECZEŃSTWO KRYTYCZNYCH PLIKÓW (.env):" >> $REPORT
# Sprawdzamy czy pliki .env nie mają zbyt luźnych uprawnień (powinny mieć 600 lub 640)
ls -la .env* >> $REPORT 2>&1

echo -e "\n[3] ROZMIAR KATALOGÓW I ŚMIECI (Pamięć podręczna Next.js i node_modules):" >> $REPORT
du -sh .next/cache >> $REPORT 2>&1
du -sh node_modules >> $REPORT 2>&1

echo -e "\n[4] LOKALNE TESTY HTTP (Dostępność kluczowych endpointów):" >> $REPORT
# PM2 dla Next.js domyślnie używa portu 3000, ale próbujemy go wyciągnąć ze środowiska
PORT=$(pm2 env 0 | grep -i 'port' | awk '{print $4}' | tr -d \',\" || echo "3000")
echo "Testowanie połączeń lokalnych na porcie: $PORT" >> $REPORT
curl -I -s http://localhost:$PORT/ | head -n 1 >> $REPORT
curl -I -s http://localhost:$PORT/api/auth/check | head -n 1 >> $REPORT
curl -I -s http://localhost:$PORT/api/stats/market | head -n 1 >> $REPORT

echo -e "\n[5] LOGI APACHE (Błędy reverse proxy i SSL):" >> $REPORT
sudo tail -n 20 /var/log/apache2/error.log >> $REPORT 2>&1

echo -e "\n[6] TESTOWANIE ZALEŻNOŚCI (Przestarzałe lub podatne paczki):" >> $REPORT
# Tylko podsumowanie audytu bezpieczeństwa paczek npm
npm audit --audit-level=high >> $REPORT 2>&1

echo "=== KONIEC FAZY 1 ===" >> $REPORT
