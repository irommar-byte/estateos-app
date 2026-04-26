const fs = require("fs");
const files = [
  "src/components/layout/Navbar.tsx",
  "src/app/moje-konto/page.tsx",
  "src/app/centrala/page.tsx"
];

const newLogout = `const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("luxestate_user");
    window.location.href = "/login";
  };`;

files.forEach(f => {
  if (fs.existsSync(f)) {
    let c = fs.readFileSync(f, "utf8");
    c = c.replace(/const handleLogout = \(\) => \{[\s\S]*?window\.location\.href = ["'][^"']*["'];\s*\};/m, newLogout);
    fs.writeFileSync(f, c);
    console.log("✅ Zaktualizowano wylogowywanie w: " + f);
  }
});
