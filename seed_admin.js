const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log("=== ODTWARZANIE KONTA ADMINISTRATORA W MARIADB ===");
  
  // Szyfrowanie hasła zgodnie z wymogami NextAuth w Twojej aplikacji
  const hashedPassword = await bcrypt.hash('Admin1234!', 10);

  try {
    const user = await prisma.user.upsert({
      where: { email: 'irommar@me.com' },
      update: {
        password: hashedPassword,
        role: 'ADMIN',
        isPro: true,
        isVerified: true
      },
      create: {
        email: 'irommar@me.com',
        name: 'Główny Administrator',
        password: hashedPassword,
        role: 'ADMIN',
        isPro: true,
        isVerified: true
      }
    });

    console.log(`✅ Sukces! Konto administratora (${user.email}) jest gotowe do akcji.`);
    console.log("Teraz możesz zalogować się w panelu.");
  } catch (error) {
    console.error("❌ Błąd podczas dodawania użytkownika:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
