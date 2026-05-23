#!/usr/bin/env node
/**
 * Jednorazowa poprawka: partner (EstateOS™ Partner) = planType AGENCY + role USER.
 * Użycie: node scripts/set-user-partner.mjs [userId]
 * Domyślnie userId=28
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '..', '.env') });

const userId = Number(process.argv[2] || '28');
if (!Number.isFinite(userId) || userId <= 0) {
  console.error('Podaj poprawne numeryczne ID użytkownika.');
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, planType: true },
  });
  if (!before) {
    console.error(`Brak użytkownika id=${userId}`);
    process.exit(1);
  }
  const after = await prisma.user.update({
    where: { id: userId },
    data: { planType: 'AGENCY', role: 'USER' },
    select: { id: true, email: true, role: true, planType: true },
  });
  console.log('Przed:', before);
  console.log('Po:   ', after);
} finally {
  await prisma.$disconnect();
}
