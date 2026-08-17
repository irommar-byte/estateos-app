import { prisma } from '@/lib/prisma';

function portalEmailFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `crm+${digits}@portal.estateos.internal`;
}

export async function ensureAgencyClientLinkedUser(params: {
  email?: string | null;
  phone?: string | null;
  name: string;
}): Promise<number | null> {
  const email = params.email ? String(params.email).trim().toLowerCase() : '';
  const phone = params.phone ? String(params.phone).trim() : '';
  const name = params.name.trim() || 'Klient CRM';

  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true, phone: true } });
    if (byEmail) {
      if (phone && !byEmail.phone) {
        await prisma.user.update({ where: { id: byEmail.id }, data: { phone } }).catch(() => {});
      }
      return byEmail.id;
    }
  }

  if (phone) {
    const byPhone = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (byPhone) return byPhone.id;
  }

  if (!email && !phone) return null;

  const created = await prisma.user.create({
    data: {
      email: email || portalEmailFromPhone(phone),
      phone: phone || null,
      name,
      role: 'USER',
    },
    select: { id: true },
  });
  return created.id;
}
