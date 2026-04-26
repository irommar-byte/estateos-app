const fs = require('fs');

// 1. NAPRAWA BACKENDU (API Ofert - sprawdzanie hasła)
const apiFile = 'src/app/api/offers/route.ts';
if (fs.existsSync(apiFile)) {
    let code = fs.readFileSync(apiFile, 'utf8');
    
    const oldAuthLogic = /if\s*\(body\.email\)\s*\{[\s\S]*?userId\s*=\s*user\.id;\s*\}/;
    const newAuthLogic = `if (body.email) {
      let user = await prisma.user.findUnique({ where: { email: body.email } });
      if (!user) {
        user = await prisma.user.create({ data: { email: body.email, password: body.password || "123456", name: body.contactName, phone: body.contactPhone } });
      } else {
        // ZABEZPIECZENIE: Weryfikacja hasła dla istniejącego konta!
        if (user.password !== body.password) {
          return NextResponse.json({ error: "BŁĘDNE HASŁO: To konto już istnieje. Podaj prawidłowe hasło, aby dodać ofertę do swojego konta." }, { status: 401 });
        }
      }
      userId = user.id;
    }`;
    
    code = code.replace(oldAuthLogic, newAuthLogic);
    fs.writeFileSync(apiFile, code);
}

// 2. NAPRAWA FRONTENDU (Kreator Ofert - wyświetlanie błędu zamiast przechodzenia dalej)
const frontendFile = 'src/app/dodaj-oferte/page.tsx';
if (fs.existsSync(frontendFile)) {
    let code = fs.readFileSync(frontendFile, 'utf8');
    
    const oldSubmit = /const handleSubmit = async \(\) => \{[\s\S]*?router\.push\(\`\/moje-konto\?email=\$\{data\.email\}\`\);\s*\};/;
    const newSubmit = `const handleSubmit = async () => {
    const res = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data, propertyType: data.propertyType || "Mieszkanie", district: data.district || "Śródmieście",
        images: imagesList.join(","), imageUrl: imagesList[0] || undefined
      }),
    });
    
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Wystąpił błąd serwera.");
      return; // Przerywamy dodawanie oferty!
    }
    
    setStep(1); setImagesList([]); router.push(\`/moje-konto?email=\${data.email}\`);
  };`;
  
    code = code.replace(oldSubmit, newSubmit);
    fs.writeFileSync(frontendFile, code);
}

console.log("ZABEZPIECZENIA WPROWADZONE!");
