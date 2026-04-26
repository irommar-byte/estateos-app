#!/bin/bash
REPORT="audit_report_faza3.txt"
echo "=== START AUDYTU FAZA 3: BEZPIECZEŃSTWO ENDPOINTÓW I CRM ===" > $REPORT

echo -e "\n[1] OCHRONA CENTRALI I API (Brak middleware):" >> $REPORT
# Sprawdzamy, jak serwer weryfikuje admina na backendzie
cat src/app/centrala/layout.tsx >> $REPORT 2>/dev/null || echo "Brak src/app/centrala/layout.tsx" >> $REPORT
cat src/app/api/admin/dashboard/route.ts >> $REPORT 2>/dev/null || echo "Brak pliku route dla dashboardu admina" >> $REPORT

echo -e "\n[2] WERYFIKACJA LOGIKI CRM (Wyciek bazy kupujących):" >> $REPORT
# Analizujemy sposób przypisywania flagi isPremium i pobierania bazy w CRM
grep -n -E "isPremium|role|baza|kupuj|Subskrypcja" src/app/moje-konto/crm/page.tsx | head -n 40 >> $REPORT 2>&1

echo -e "\n[3] BEZPIECZEŃSTWO API DANYCH CRM:" >> $REPORT
# Sprawdzamy, czy API samo w sobie weryfikuje subskrypcję Agencja Pro przed zwróceniem danych
cat src/app/api/crm/data/route.ts >> $REPORT 2>/dev/null || echo "Brak endpointu API: src/app/api/crm/data/route.ts" >> $REPORT

echo "=== KONIEC FAZY 3 ===" >> $REPORT
