const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function sprawdz() {
  console.log("🔍 Szukam oferty ID 13 w bazie danych...");
  
  const offer13 = await prisma.offer.findUnique({ 
    where: { id: 13 },
    select: { id: true, title: true, status: true, userId: true, createdAt: true }
  });

  if (offer13) {
    console.log("✅ OFERTA 13 ISTNIEJE! Oto jej dane:");
    console.table(offer13);
  } else {
    console.log("❌ OFERTA 13 FIZYCZNIE NIE ISTNIEJE W BAZIE DANYCH!");
  }

  console.log("\n📊 Zobaczmy 5 najnowszych ofert w systemie, żeby zobaczyć gdzie urwało:");
  const lastOffers = await prisma.offer.findMany({
    take: 5,
    orderBy: { id: 'desc' },
    select: { id: true, title: true, status: true, userId: true }
  });
  console.table(lastOffers);
}

sprawdz().finally(() => prisma.$disconnect());
