const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log("⏳ Łączenie z bazą danych...");
    const user = await prisma.user.create({
      data: { 
        email: `diagnoza_bazy_${Date.now()}@test.com`, 
        password: "haslo123",
        name: "Test Bazy"
      }
    });
    console.log("✅ SUKCES! BAZA DANYCH JEST W 100% SPRAWNA. Użytkownik zapisany:", user.email);
  } catch(e) {
    console.log("🔥 ZNALEZIONO BŁĄD PRISMA:");
    console.log(e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
