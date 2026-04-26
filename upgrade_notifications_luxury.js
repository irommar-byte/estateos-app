const fs = require('fs');
const path = require('path');

console.log("=== WDRAŻANIE POWIADOMIEŃ KLASY ELITE (POPRAWKA) ===");

// 1. Navbar: Widoczność dzwoneczka tylko dla zalogowanych
const navbarPath = path.join(process.cwd(), 'src', 'components', 'layout', 'Navbar.tsx');
try {
  let navCode = fs.readFileSync(navbarPath, 'utf8');
  navCode = navCode.replace(/<NotificationCenter \/>/g, '{user && <NotificationCenter />}');
  navCode = navCode.replace(/Cennik PRO/g, 'EstateOS™ Elite');
  fs.writeFileSync(navbarPath, navCode);
  console.log("✅ [1/2] Dzwoneczek ustawiony jako prywatny dla zalogowanych.");
} catch(e) { console.error("Błąd Navbar:", e.message); }

// 2. NotificationCenter: Luxury Pulse i Browser Push
const notifPath = path.join(process.cwd(), 'src', 'components', 'layout', 'NotificationCenter.tsx');
try {
  let code = fs.readFileSync(notifPath, 'utf8');

  const pushFunction = `
  const requestPush = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification("EstateOS™ Online", {
        body: "Powiadomienia systemowe zostały aktywowane.",
        icon: "/favicon.ico"
      });
    }
  };
  `;

  if (!code.includes('const requestPush')) {
    code = code.replace(/export default function NotificationCenter\(\) \{/, `export default function NotificationCenter() {\n  ${pushFunction}`);
  }

  // CZYSTY KOD BEZ BŁĘDU SKŁADNI:
  const luxuryDot = `
    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 z-50">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 shadow-[0_0_12px_rgba(220,38,38,1)]"></span>
    </span>
  `;

  code = code.replace(/<span className="absolute -top-1 -right-1[^>]*><\/span>/g, luxuryDot);
  
  // Bezpieczne wpięcie funkcji requestPush
  if (!code.includes('requestPush();')) {
      code = code.replace(/onClick=\{([^\}]+)\}/, 'onClick={(e) => { $1; requestPush(); }}');
  }

  fs.writeFileSync(notifPath, code);
  console.log("✅ [2/2] Wdrożono Luxury Pulse i mechanizm Web Push.");
} catch(e) { console.error("Błąd NotificationCenter:", e.message); }

console.log("=== GOTOWE ===");
