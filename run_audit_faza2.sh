#!/bin/bash
REPORT="audit_report_faza2.txt"
echo "=== START AUDYTU FAZA 2: LOGIKA, BAZA DANYCH I ZABEZPIECZENIA ===" > $REPORT

echo -e "\n[1] NAPRAWA UPRAWNIEŃ .env:" >> $REPORT
chmod 600 .env*
ls -la .env* >> $REPORT 2>&1
echo "Uprawnienia zmienione na bezpieczne (600)." >> $REPORT

echo -e "\n[2] STRUKTURA BAZY DANYCH (Schemat ról i subskrypcji):" >> $REPORT
# Szukamy definicji ról, subskrypcji i powiązań z użytkownikiem, żeby zobaczyć dokładne nazewnictwo
if [ -f "prisma/schema.prisma" ]; then
  cat prisma/schema.prisma | grep -E -i "model User|role|Role|Subscription|plan|type|partner|wlasciciel|pro" -B 2 -A 5 >> $REPORT 2>&1
else
  echo "Brak pliku prisma/schema.prisma." >> $REPORT
fi

echo -e "\n[3] WERYFIKACJA MIDDLEWARE (Ochrona endpointów na poziomie serwera):" >> $REPORT
if [ -f "middleware.ts" ]; then
  cat middleware.ts >> $REPORT 2>&1
elif [ -f "src/middleware.ts" ]; then
  cat src/middleware.ts >> $REPORT 2>&1
else
  echo "Nie znaleziono głównego pliku middleware (middleware.ts lub src/middleware.ts)." >> $REPORT
fi

echo -e "\n[4] SKANOWANIE KRYTYCZNEJ LOGIKI BIZNESOWEJ:" >> $REPORT
# Sprawdzamy gdzie w kodzie sprawdzane są subskrypcje i dostęp do bazy (agencja pro, inwestor pro, kupujacy)
echo "Wyniki wyszukiwania logiki dostępowej (pierwsze 40 trafień):" >> $REPORT
grep -rniE "agencja.*pro|inwestor.*pro|tryb.*partnera|tryb.*wlasciciela|baza.*kupujacych|role|subscription" app/ api/ src/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -n 40 >> $REPORT

echo -e "\n[5] LOKALNE TESTY HTTP (Wymuszony port 3000):" >> $REPORT
echo "Ping API..." >> $REPORT
curl -I -s http://localhost:3000/api/auth/check | head -n 1 >> $REPORT
curl -I -s http://localhost:3000/api/stats/market | head -n 1 >> $REPORT

echo "=== KONIEC FAZY 2 ===" >> $REPORT
