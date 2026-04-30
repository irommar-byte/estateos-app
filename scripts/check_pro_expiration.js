const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🕒 Rozpoczynam sprawdzanie wygasłych abonamentów PRO...');
  const now = new Date();

  // Znajdź użytkowników, którym wygasło PRO
  const expiredUsers = await prisma.user.findMany({
    where: {
      isPro: true,
      proExpiresAt: {
        lte: now // Mniejsze lub równe "teraz"
      }
    },
    select: { id: true, email: true }
  });

  if (expiredUsers.length === 0) {
    console.log('✅ Brak wygasłych abonamentów.');
    return;
  }

  console.log(`🟡 Znaleziono ${expiredUsers.length} wygasłych kont. Przystępuję do czyszczenia...`);

  // Zbiorcza aktualizacja
  await prisma.user.updateMany({
    where: {
      id: { in: expiredUsers.map(u => u.id) }
    },
    data: {
      isPro: false,
      planType: 'NONE',
      proExpiresAt: null
    }
  });

  console.log('✅ Statusy PRO zostały odebrane.');
}

main()
  .catch((e) => {
    console.error('❌ Krytyczny błąd skryptu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
