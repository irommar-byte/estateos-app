const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audyt() {
  const user = await prisma.user.findUnique({ where: { email: 'irommar@icloud.com' } });
  if(!user) return console.log("Brak usera!");
  
  console.log(`➡️  Konto: ${user.email}`);
  console.log(`➡️  Rola: ${user.role}`);
  console.log(`➡️  Status isVerified: ${user.isVerified ? 'TAK (Zweryfikowane) ✅' : 'NIE (Wymaga SMS/Maila) ⚠️'}`);
}
audyt().finally(() => prisma.$disconnect());
