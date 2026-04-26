#!/bin/bash
REPORT="audit_report_faza4.txt"
echo "=== START AUDYTU FAZA 4: BEZPIECZEŃSTWO ZAAWANSOWANE I INFRASTRUKTURA ===" > $REPORT

echo -e "\n[1] BAZA DANYCH - WERYFIKACJA ŚRODOWISKA PRODUKCYJNEGO:" >> $REPORT
echo "Poszukiwanie definicji bazy w .env:" >> $REPORT
grep -E -i "DATABASE_URL|PRISMA" .env* >> $REPORT 2>&1
echo "Silnik Prisma (z pliku schema):" >> $REPORT
grep -E "provider.*=" prisma/schema.prisma >> $REPORT 2>&1

echo -e "\n[2] LUKI W UPLOADS (Remote Code Execution / Path Traversal):" >> $REPORT
# Sprawdzamy czy API do uploadu zdjęć filtruje typy plików (np. czy przepuści plik .php lub .js)
if [ -f "src/app/api/upload/route.ts" ]; then
  cat src/app/api/upload/route.ts | grep -E -i "extension|mimetype|path|fs\.|writeFile|type" -B 2 -A 2 >> $REPORT 2>&1
else
  echo "Nie znaleziono src/app/api/upload/route.ts" >> $REPORT
fi

echo -e "\n[3] BEZPIECZEŃSTWO PŁATNOŚCI STRIPE (Fałszowanie transakcji):" >> $REPORT
# Sprawdzamy czy webhook z płatnościami faktycznie weryfikuje podpis Stripe (stripe-signature)
if [ -f "src/app/api/stripe/webhook/route.ts" ]; then
  cat src/app/api/stripe/webhook/route.ts | grep -E -i "constructEvent|stripe-signature|secret" -B 2 -A 3 >> $REPORT 2>&1
else
  echo "Nie znaleziono src/app/api/stripe/webhook/route.ts" >> $REPORT
fi

echo -e "\n[4] WALIDACJA WEJŚCIA I RATE LIMITING (Ochrona przed atakami Brute-Force/DDoS):" >> $REPORT
# Szukamy bibliotek do walidacji (zod, joi) i mechanizmów limitowania zapytań
grep -rniE "rate.?limit|zod|validator|Too Many" src/app/api/auth/ src/app/api/register/ src/app/api/login/ 2>/dev/null | head -n 20 >> $REPORT
if [ ! -s $REPORT ]; then echo "Brak wyraźnego użycia Zod/Rate Limitera w głównych ścieżkach auth." >> $REPORT; fi

echo -e "\n[5] BEZPIECZEŃSTWO NAGŁÓWKÓW NEXT.JS:" >> $REPORT
# Sprawdzamy czy next.config.js wymusza nagłówki bezpieczeństwa (CSP, X-Frame-Options)
cat next.config.ts next.config.js 2>/dev/null | grep -E -i "headers|security|Content-Security-Policy" -B 2 -A 5 >> $REPORT || echo "Brak definicji nagłówków security w konfiguracji Next.js" >> $REPORT

echo -e "\n[6] POSZUKIWANIE UKRYTYCH DŁUGÓW (TODO/FIXME):" >> $REPORT
# Szukamy miejsc w kodzie, które deweloper zaznaczył do poprawy, ale o nich zapomniał
grep -rniE "TODO:|FIXME:|HACK:" src/ 2>/dev/null | head -n 30 >> $REPORT

echo "=== KONIEC FAZY 4 ===" >> $REPORT
