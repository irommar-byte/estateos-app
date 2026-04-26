async function runSimulation() {
  const fs = require('fs');
  const baseUrl = 'http://localhost:3000';
  let report = "=== START SYMULACJI PROCESÓW BIZNESOWYCH ===\n";
  let cookie = '';
  
  const testEmail = `audyt_${Date.now()}@estateos.test`;
  const testUser = { email: testEmail, password: 'Password123!', name: 'Audytor', role: 'SELLER' };

  try {
    report += `\n[1] AKCJA: Rejestracja nowego użytkownika (${testEmail})\n`;
    const regRes = await fetch(`${baseUrl}/api/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    report += `-> Status HTTP: ${regRes.status}\n`;
    report += `-> Odpowiedź: ${await regRes.text()}\n`;

    report += `\n[2] AKCJA: Logowanie i pobieranie ciasteczka sesji\n`;
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'Password123!' })
    });
    report += `-> Status HTTP: ${loginRes.status}\n`;
    
    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) {
      cookie = setCookie.split(';')[0];
      report += `-> Sesja ustanowiona: TAK\n`;
    } else {
      report += `-> Sesja ustanowiona: NIE (Brak ciasteczka)\n`;
    }

    report += `\n[3] AKCJA: Próba dostępu do API CRM (Baza danych) bez pakietu Agencja PRO\n`;
    const crmRes = await fetch(`${baseUrl}/api/crm/data`, {
      headers: { 'Cookie': cookie }
    });
    report += `-> Status HTTP: ${crmRes.status}\n`;
    if (crmRes.status === 200) {
      report += `-> WYNIK: KRYTYCZNY BŁĄD LOGIKI. Serwer zwrócił dane CRM pomimo braku subskrypcji!\n`;
    } else {
      report += `-> WYNIK: POPRAWNIE. Serwer zablokował dostęp.\n`;
    }

    report += `\n[4] AKCJA: Próba włamania do Centrali (Endpoint Admina) ze zwykłego konta\n`;
    const adminRes = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { 'Cookie': cookie }
    });
    report += `-> Status HTTP: ${adminRes.status}\n`;
    if (adminRes.status === 200) {
      report += `-> WYNIK: KRYTYCZNY BŁĄD LOGIKI. Zwykły użytkownik wszedł do panelu Admina!\n`;
    } else {
      report += `-> WYNIK: POPRAWNIE. Serwer zablokował dostęp do panelu Centrali.\n`;
    }

  } catch (error) {
    report += `\nBłąd wykonania symulacji: ${error.message}\n`;
  }

  report += "\n=== KONIEC SYMULACJI ===\n";
  fs.writeFileSync('audit_report_faza5.txt', report);
  console.log(report);
}

runSimulation();
