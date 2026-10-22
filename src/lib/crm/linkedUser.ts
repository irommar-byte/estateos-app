import { prisma } from '@/lib/prisma';

function portalEmailFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `crm+${digits}@portal.estateos.internal`;
}

export async function ensureAgencyClientLinkedUser(params: {
  email?: string | null;
  phone?: string | null;
  name: string;
  /**
   * Link to an account that already exists with this e-mail / phone. Off for agent-entered data:
   * an agent typing someone's e-mail must not attach (or see) that person's account. Existing
   * users are linked when they sign in themselves (listAndLinkPortalsForUser).
   */
  linkExisting?: boolean;
}): Promise<number | null> {
  const email = params.email ? String(params.email).trim().toLowerCase() : '';
  const phone = params.phone ? String(params.phone).trim() : '';
  const name = params.name.trim() || 'Klient CRM';

  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (byEmail) return params.linkExisting ? byEmail.id : null;
  }

  if (phone) {
    const byPhone = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (byPhone) return params.linkExisting ? byPhone.id : null;
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
