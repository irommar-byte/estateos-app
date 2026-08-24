import { prisma } from '@/lib/prisma';
import { buildPhoneLookupVariants, normalizePhoneE164 } from '@/lib/phoneE164';
import { hashPesel } from '@/lib/crm/peselHash';

export type DuplicateClientMatch = {
  id: number;
  type: 'BUYER' | 'SELLER';
  status: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  matchedBy: { email: boolean; phone: boolean; pesel?: boolean };
};

export type PeselCollision = {
  exists: boolean;
  /** True when PESEL already exists anywhere in EstateOS (any agency). Never includes PESEL value or owner data. */
  message: string | null;
};

/** Email/phone duplicates within the same agent CRM. Never returns PESEL. */
export async function findDuplicateAgencyClients(params: {
  agencyUserId: number;
  email?: string | null;
  phone?: string | null;
  excludeId?: number;
}): Promise<DuplicateClientMatch[]> {
  const email = params.email ? String(params.email).trim().toLowerCase() : '';
  const phoneE164 = normalizePhoneE164(params.phone);
  const phoneVariants = phoneE164 ? buildPhoneLookupVariants(phoneE164) : [];
  if (!email && !phoneVariants.length) return [];

  const or: Array<{ email?: string; phone?: { in: string[] } }> = [];
  if (email) or.push({ email });
  if (phoneVariants.length) or.push({ phone: { in: phoneVariants } });

  const rows = await prisma.agencyClient.findMany({
    where: {
      agencyUserId: params.agencyUserId,
      status: 'ACTIVE',
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      OR: or,
    },
    orderBy: { updatedAt: 'desc' },
    take: 8,
    select: {
      id: true,
      type: true,
      status: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    matchedBy: {
      email: Boolean(email && row.email?.toLowerCase() === email),
      phone: Boolean(
        phoneE164 &&
          (normalizePhoneE164(row.phone) === phoneE164 ||
            phoneVariants.includes(String(row.phone || ''))),
      ),
    },
  }));
}

/**
 * Privacy-preserving PESEL collision check.
 * Never returns the stored PESEL, owner identity, or any contact fields.
 */
export async function findPeselCollision(params: {
  pesel?: string | null;
  excludeId?: number;
}): Promise<PeselCollision> {
  const peselHash = hashPesel(params.pesel);
  if (!peselHash) return { exists: false, message: null };

  const existing = await prisma.agencyClient.findFirst({
    where: {
      peselHash,
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    select: { id: true },
  });

  if (!existing) return { exists: false, message: null };
  return {
    exists: true,
    message: 'Ta osoba jest już w EstateOS. Możesz dodać klienta do swojego CRM — PESEL nie zostanie ujawniony innym agentom.',
  };
}
