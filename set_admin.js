const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setAdmin() {
  try {
    await prisma.user.upsert({
      where: { email: 'irommar@me.com' },
      update: { 
        role: 'ADMIN', 
        password: 'Admin1234!' 
      },
      create: { 
        email: 'irommar@me.com', 
        password: 'Admin1234!', 
        role: 'ADMIN', 
        name: 'Właściciel' 
      }
    });
    console.log('\n✅ SUKCES! Konto irommar@me.com ma teraz uprawnienia ADMIN i hasło Admin1234!\n');
  } catch (error) {
    console.error('❌ Błąd bazy danych:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setAdmin();
