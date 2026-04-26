const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.update({
  where: { email: 'irommar@icloud.com' },
  data: { isVerified: true }
}).then(() => {
  console.log("✅ KONTO ZWERYFIKOWANE! Blokada SMS/Mail zdjęta.");
  prisma.$disconnect();
});
