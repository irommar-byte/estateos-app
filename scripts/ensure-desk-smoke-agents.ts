/**
 * Ensure temporary Desk smoke test agents (A/B) with known credentials.
 * Run: DATABASE_URL=... npx tsx scripts/ensure-desk-smoke-agents.ts
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

const PASSWORD = 'DeskSmoke2026!Test';

const AGENTS = [
  { email: 'desk-smoke-a@staging.test', name: 'Desk Smoke A', phone: '+48555111001' },
  { email: 'desk-smoke-b@staging.test', name: 'Desk Smoke B', phone: '+48555111002' },
] as const;

async function main() {
  let companyId: number | null = null;
  let ownerId: number | null = null;

  for (let i = 0; i < AGENTS.length; i++) {
    const a = AGENTS[i];
    const hash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.upsert({
      where: { email: a.email },
      create: {
        email: a.email,
        name: a.name,
        phone: a.phone,
        password: hash,
        role: 'AGENT',
        planType: 'PRO',
        isPro: true,
        isVerified: true,
      },
      update: {
        name: a.name,
        phone: a.phone,
        password: hash,
        role: 'AGENT',
        planType: 'PRO',
        isPro: true,
        isVerified: true,
      },
      select: { id: true, email: true },
    });

    if (i === 0) ownerId = user.id;

    if (!companyId && ownerId) {
      const existingCompany = await prisma.agencyCompany.findFirst({
        where: { slug: 'desk-smoke-staging' },
        select: { id: true },
      });
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const co = await prisma.agencyCompany.create({
          data: {
            name: 'Desk Smoke Staging',
            slug: 'desk-smoke-staging',
            ownerUserId: ownerId,
          },
        });
        companyId = co.id;
      }
    }

    await prisma.agencyCompanyMember.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        companyId: companyId!,
        role: 'AGENT',
        status: 'ACTIVE',
        approvedAt: new Date(),
      },
      update: { status: 'ACTIVE', companyId: companyId! },
    });

    console.log(`OK agent ${user.email} id=${user.id}`);
  }

  console.log(`\nCredentials (staging only):`);
  console.log(`  email: desk-smoke-a@staging.test | desk-smoke-b@staging.test`);
  console.log(`  password: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
