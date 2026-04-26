const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const updatedUser = await prisma.user.update({
      where: { email: 'marian.romanienko@gmail.com' },
      data: { isVerified: true }
    });
    console.log(`✅ SUKCES! Konto ${updatedUser.email} zostało pomyślnie zweryfikowane!`);
  } catch (error) {
    console.log(`❌ BŁĄD: Nie znaleziono konta lub wystąpił inny problem:`, error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
