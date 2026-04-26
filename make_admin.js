const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function setAdmin() {
  try {
    const res = await prisma.user.updateMany({
      where: { email: 'admin@estateos.pl' },
      data: { role: 'ADMIN', password: 'admin123' }
    });
    if (res.count > 0) {
      console.log("✅ Sukces: admin@estateos.pl ma teraz rolę ADMIN i hasło admin123");
    } else {
      console.log("❌ Nie znaleziono konta admin@estateos.pl - dodaj najpierw ofertę z tego maila, aby utworzyć konto.");
    }
  } catch(e) { console.error(e); }
}
setAdmin().finally(() => prisma.$disconnect());
