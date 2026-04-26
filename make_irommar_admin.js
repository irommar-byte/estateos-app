const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function makeGodMode() {
  try {
    const adminEmail = 'irommar@me.com';
    
    // Używamy "upsert" - jeśli konto nie istnieje, stworzy je. 
    // Jeśli istnieje, po prostu zaktualizuje mu rolę i hasło.
    const user = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { 
        role: 'ADMIN', 
        password: 'admin123' // Ustawiamy twarde hasło, żebyś na 100% wszedł
      },
      create: {
        email: adminEmail,
        password: 'admin123',
        role: 'ADMIN',
        name: 'Właściciel Systemu'
      }
    });
    
    console.log(`\n✅ SUKCES! Konto ${user.email} to teraz nietykalny Master Admin.`);
    console.log(`🔑 Twój login: ${user.email}`);
    console.log(`🔑 Twoje hasło: admin123\n`);
    
  } catch (error) {
    console.error("❌ Błąd bazy danych:", error);
  } finally {
    await prisma.$disconnect();
  }
}

makeGodMode();
