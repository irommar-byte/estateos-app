import { prisma } from '@/lib/prisma';
import { formatAgentTitle, pickAgentAvatar, resolveProfileMediaUrl } from '@/lib/agentProfile';
import { ESTATEOS_SITE_URL } from '@/lib/estateOsPublicFacts';
import { decryptSession, encryptSession } from '@/lib/sessionUtils';
import {
  BUYER_MISSION_COOKIE,
  BUYER_MISSION_MAX_AGE_SEC,
  BUYER_PROPERTY_OPTIONS,
  normalizeBuyerDistricts,
  normalizeBuyerRooms,
  normalizeBuyerAreaRange,
  normalizeBuyerMarketType,
  normalizeBuyerPurchaseTimeline,
  normalizeBuyerTransactionType,
  type BuyerMissionRecord,
  type BuyerPropertyType,
} from '@/lib/buyerIntakeShared';

export {
  BUYER_MISSION_COOKIE,
  BUYER_MISSION_MAX_AGE_SEC,
  BUYER_PROPERTY_OPTIONS,
  type BuyerMissionRecord,
  type BuyerPropertyType,
};

function resolveBuyerIntakeAgentImage(raw: string | null | undefined): string | null {
  const relative = resolveProfileMediaUrl(raw);
  if (!relative) return null;
  if (/^https?:\/\//i.test(relative)) return relative;
  const origin = String(process.env.NEXT_PUBLIC_SITE_ORIGIN || ESTATEOS_SITE_URL).replace(/\/$/, '');
  return `${origin}${relative.startsWith('/') ? relative : `/${relative}`}`;
}

async function mapBuyerIntakeAgent(user: {
  id: number;
  name: string | null;
  companyName: string | null;
  image: string | null;
  companyLogoUrl: string | null;
}) {
  const membership = await prisma.agencyCompanyMember.findUnique({
    where: { userId: user.id },
    select: {
      profilePhotoUrl: true,
      agentTitle: true,
      company: { select: { logoUrl: true, name: true } },
    },
  });

  const avatarRaw = pickAgentAvatar({
    profilePhotoUrl: membership?.profilePhotoUrl,
    userImage: user.image,
    companyLogoUrl: membership?.company?.logoUrl ?? user.companyLogoUrl,
  });

  const titleLabel = membership?.agentTitle ? formatAgentTitle(membership.agentTitle) : 'Agent nieruchomości';
  const companyLabel = membership?.company?.name || user.companyName || 'EstateOS™';

  return {
    userId: user.id,
    displayName: String(user.name || '').trim() || 'Twój agent',
    companyName: companyLabel,
    agentTitle: titleLabel,
    image: resolveBuyerIntakeAgentImage(avatarRaw),
  };
}

async function loadBuyerIntakeAgentUser(where: { id: number } | { email: string }) {
  return prisma.user.findUnique({
    where,
    select: { id: true, name: true, companyName: true, image: true, companyLogoUrl: true },
  });
}

export async function resolveBuyerIntakeAgent(): Promise<{
  userId: number;
  displayName: string;
  companyName: string | null;
  agentTitle: string;
  image: string | null;
} | null> {
  const envId = Number(process.env.BUYER_INTAKE_AGENT_USER_ID);
  if (Number.isFinite(envId) && envId > 0) {
    const user = await loadBuyerIntakeAgentUser({ id: envId });
    if (user) return mapBuyerIntakeAgent(user);
  }

  const envEmail = String(process.env.BUYER_INTAKE_AGENT_EMAIL || '').trim().toLowerCase();
  if (envEmail) {
    const user = await loadBuyerIntakeAgentUser({ email: envEmail });
    if (user) return mapBuyerIntakeAgent(user);
  }

  return null;
}

function normalizePropertyType(value: unknown): BuyerPropertyType | null {
  const propertyType = String(value || '').trim();
  if (
    propertyType === 'apartment' ||
    propertyType === 'house' ||
    propertyType === 'plot' ||
    propertyType === 'commercial'
  ) {
    return propertyType;
  }
  return null;
}

function normalizeMissionBody(body: Partial<BuyerMissionRecord> & { v?: number; rooms?: unknown; districts?: unknown }): BuyerMissionRecord | null {
  if (body.typ !== 'buyer_mission') return null;
  const version = Number(body.v);
  if (version !== 1 && version !== 2) return null;

  const agentUserId = Number(body.agentUserId);
  if (!Number.isFinite(agentUserId) || agentUserId <= 0) return null;

  const propertyType = body.propertyType == null ? null : normalizePropertyType(body.propertyType);
  if (body.propertyType != null && !propertyType) return null;

  const cityRaw = body.city == null ? null : String(body.city).trim().slice(0, 128);
  const budgetMax = body.budgetMax == null ? null : Number(body.budgetMax);
  const areaRange = normalizeBuyerAreaRange({ minArea: body.minArea, maxArea: body.maxArea });

  return {
    typ: 'buyer_mission',
    v: 2,
    agentUserId,
    propertyType,
    step: Number(body.step) > 0 ? Number(body.step) : 1,
    city: cityRaw || null,
    districts: normalizeBuyerDistricts(body.districts),
    budgetMax: budgetMax != null && Number.isFinite(budgetMax) && budgetMax > 0 ? Math.round(budgetMax) : null,
    minArea: areaRange.minArea,
    maxArea: areaRange.error ? null : areaRange.maxArea,
    rooms: normalizeBuyerRooms(body.rooms),
    requireBalcony: Boolean(body.requireBalcony),
    requireGarden: Boolean(body.requireGarden),
    requireElevator: Boolean(body.requireElevator),
    requireParking: Boolean(body.requireParking),
    requireFurnished: Boolean(body.requireFurnished),
    requireTwoLevel: Boolean(body.requireTwoLevel),
    marketType: normalizeBuyerMarketType(body.marketType),
    transactionType: normalizeBuyerTransactionType(body.transactionType),
    purchaseTimeline: normalizeBuyerPurchaseTimeline(body.purchaseTimeline),
    firstName: body.firstName == null ? null : String(body.firstName).trim().slice(0, 96) || null,
    lastName: body.lastName == null ? null : String(body.lastName).trim().slice(0, 96) || null,
    email: body.email == null ? null : String(body.email).trim().toLowerCase().slice(0, 191) || null,
    phone: body.phone == null ? null : String(body.phone).trim().slice(0, 32) || null,
    clientId: Number(body.clientId) > 0 ? Number(body.clientId) : null,
    consentContact: Boolean(body.consentContact),
  };
}

export function encodeBuyerMissionCookie(record: Omit<BuyerMissionRecord, 'typ' | 'v'>): string {
  const payload: BuyerMissionRecord = {
    ...createInitialBuyerMission(record.agentUserId),
    ...record,
    typ: 'buyer_mission',
    v: 2,
  };
  return encryptSession(payload as unknown as Record<string, unknown>);
}

export function decodeBuyerMissionCookie(raw: string | null | undefined): BuyerMissionRecord | null {
  const decoded = decryptSession(String(raw || ''));
  if (!decoded || typeof decoded !== 'object') return null;
  return normalizeMissionBody(decoded as Partial<BuyerMissionRecord> & { v?: number; rooms?: unknown; districts?: unknown });
}

export function createInitialBuyerMission(agentUserId: number): BuyerMissionRecord {
  return {
    typ: 'buyer_mission',
    v: 2,
    agentUserId,
    propertyType: null,
    step: 1,
    city: null,
    districts: [],
    budgetMax: null,
    minArea: null,
    maxArea: null,
    rooms: [],
    requireBalcony: false,
    requireGarden: false,
    requireElevator: false,
    requireParking: false,
    requireFurnished: false,
    requireTwoLevel: false,
    marketType: null,
    transactionType: null,
    purchaseTimeline: null,
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    clientId: null,
    consentContact: false,
  };
}

export function mergeBuyerMission(
  base: BuyerMissionRecord | null,
  agentUserId: number,
  patch: Partial<Omit<BuyerMissionRecord, 'typ' | 'v' | 'agentUserId'>>,
): BuyerMissionRecord {
  const seed = base && base.agentUserId === agentUserId ? base : createInitialBuyerMission(agentUserId);
  return normalizeMissionBody({ ...seed, ...patch, typ: 'buyer_mission', v: 2, agentUserId }) ?? createInitialBuyerMission(agentUserId);
}
