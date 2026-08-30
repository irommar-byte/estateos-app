import { prisma } from '@/lib/prisma';
import { setVerificationStatusInDescription } from '@/lib/offerVerification';

const KW_RE = /^[A-Z]{2}[A-Z0-9]{2}\/\d{8}\/\d$/;

export function normalizeAcquisitionKw(raw: unknown): string | null {
  const kw = String(raw || '').trim().toUpperCase();
  return KW_RE.test(kw) ? kw : null;
}

export async function stampKwFromAcquisitionForm(params: {
  offerId?: number | null;
  agentUserId: number;
  formData?: unknown;
}): Promise<void> {
  const offerId = Number(params.offerId || 0);
  if (!offerId) return;
  const form = (params.formData && typeof params.formData === 'object' ? params.formData : {}) as Record<string, any>;
  const ownership = (form.ownership || {}) as Record<string, any>;
  const property = (form.property || {}) as Record<string, any>;
  const kw = normalizeAcquisitionKw(ownership.landRegisterNumber);
  if (!kw) return;
  await stampOfferLandRegistryVerifiedByAgent({
    offerId,
    agentUserId: params.agentUserId,
    landRegistryNumber: kw,
    apartmentNumber: String(property.apartmentNumber || '').trim() || null,
  });
}

/** Agent sprawdził KW przy pozysku — zapis na stałe, tarcza zielona, bez kolejki admina. */
export async function stampOfferLandRegistryVerifiedByAgent(params: {
  offerId: number;
  agentUserId: number;
  landRegistryNumber: string;
  apartmentNumber?: string | null;
}): Promise<void> {
  const landRegistryNumber = normalizeAcquisitionKw(params.landRegistryNumber);
  if (!landRegistryNumber) return;
  const offerId = Number(params.offerId);
  const agentUserId = Number(params.agentUserId);
  if (!offerId || !agentUserId) return;
  const apartmentNumber = String(params.apartmentNumber || '').trim() || null;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const prev = await tx.offer.findUnique({
      where: { id: offerId },
      select: {
        id: true,
        description: true,
        isLegalSafeVerified: true,
        legalCheckStatus: true,
        landRegistryNumber: true,
      } as any,
    });
    if (!prev) return;

    await tx.offer.update({
      where: { id: offerId },
      data: {
        landRegistryNumber,
        apartmentNumber,
        legalCheckStatus: 'VERIFIED',
        legalCheckSubmittedAt: now,
        legalCheckReviewedAt: now,
        legalCheckReviewedBy: agentUserId,
        legalCheckRejectionReason: null,
        legalCheckRejectionText: null,
        isLegalSafeVerified: true,
        description: setVerificationStatusInDescription((prev as { description?: string }).description, 'VERIFIED'),
      } as any,
    });

    const pending = await tx.legalVerificationRequest.findFirst({
      where: { offerId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) {
      await tx.legalVerificationRequest.update({
        where: { id: pending.id },
        data: {
          status: 'APPROVED',
          landRegistryNumber,
          apartmentNumber,
          note: pending.note || 'Zweryfikowane przez agenta przy pozyskaniu.',
        },
      });
      return;
    }

    const latest = await tx.legalVerificationRequest.findFirst({
      where: { offerId },
      orderBy: { createdAt: 'desc' },
    });
    if (latest && String(latest.status).toUpperCase() === 'APPROVED') {
      if (latest.landRegistryNumber !== landRegistryNumber) {
        await tx.legalVerificationRequest.update({
          where: { id: latest.id },
          data: { landRegistryNumber, apartmentNumber },
        });
      }
      return;
    }

    await tx.legalVerificationRequest.create({
      data: {
        offerId,
        requesterId: agentUserId,
        status: 'APPROVED',
        landRegistryNumber,
        apartmentNumber,
        note: 'Zweryfikowane przez agenta przy pozyskaniu.',
      },
    });
  });
}
