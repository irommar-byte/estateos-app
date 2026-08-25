import { prisma } from '@/lib/prisma';
import { buildDiscoveryBuyerBrief } from '@/lib/discoveryInsights';
import {
  discoveryDisplayLabel,
  discoveryPropertyTypeLabel,
} from '@/lib/discovery/displayLabels';

export type GuideIntentStage = 'EXPLORE' | 'FOCUS' | 'READY' | 'COMPLETE';

export type GuideActionKey =
  | 'DISCOVERY'
  | 'TROPES'
  | 'MAP'
  | 'DIRECTION'
  | 'LUSTRO'
  | 'PROFILE'
  | 'CONTACT';

export type GuideCta = {
  label: string;
  href: string;
  action: GuideActionKey;
};

export type EstateOsGuideContext = {
  confidence: number;
  contradictionIndex: number;
  profileUpdatedAt: Date | null;
  searchPhase: string;
  intentStage: GuideIntentStage;
  intentLabel: string;
  body: string;
  summaryLine: string;
  /** Short human chips for UI (city · type) — never a param dump. */
  evidenceHint: string | null;
  decisionCount: number;
  tropes: Array<{
    offerId: number;
    status: string;
    priority: boolean;
    visitOutcome: string | null;
    updatedAt: Date;
  }>;
  knows: {
    city: string | null;
    district: string | null;
    budgetPln: number | null;
    areaM2: number | null;
    transaction: 'SELL' | 'RENT' | 'MIXED' | null;
    dislikeReasons: string[];
    lastNotes: string[];
  };
  nextStep: {
    key: string;
    title: string;
    action: GuideActionKey;
    offerId?: number | null;
  };
  primaryCta: GuideCta;
  secondaryCta: GuideCta;
  stageProgress: number;
};

const STAGE_LABEL: Record<GuideIntentStage, string> = {
  EXPLORE: 'Odkrywanie',
  FOCUS: 'Fokus',
  READY: 'Na tropie',
  COMPLETE: 'Domknięte',
};

function resolveHref(action: GuideActionKey, offerId?: number | null): string {
  switch (action) {
    case 'TROPES':
      return offerId ? `/oferta/${offerId}` : '/moj-kierunek';
    case 'MAP':
      return '/odkryj-mape';
    case 'DIRECTION':
    case 'LUSTRO':
    case 'PROFILE':
      return '/moj-kierunek';
    case 'CONTACT':
      return '/moje-konto/wiadomosci';
    case 'DISCOVERY':
    default:
      return '/oferty';
  }
}

function buildCta(label: string, action: GuideActionKey, offerId?: number | null): GuideCta {
  return { label, action, href: resolveHref(action, offerId) };
}

/**
 * Guide 2.0 — stage-aware copy from Discovery profile + tropes.
 * Never throws for cold start; always returns a usable next step.
 */
export async function buildEstateOsGuideContext(userId: number): Promise<EstateOsGuideContext> {
  const [profile, tropes, noteEvents] = await Promise.all([
    prisma.discoveryProfile.findUnique({ where: { userId } }),
    prisma.discoveryTrope.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 5,
      select: { offerId: true, status: true, priority: true, visitOutcome: true, updatedAt: true },
    }),
    prisma.discoveryEvent.findMany({
      where: { userId, correctionTarget: { startsWith: 'note:' } },
      orderBy: { at: 'desc' },
      take: 3,
      select: { correctionTarget: true },
    }),
  ]);

  const brief = buildDiscoveryBuyerBrief({
    likesCount: profile?.likesCount || 0,
    dislikesCount: profile?.dislikesCount || 0,
    fastTrackCount: profile?.fastTrackCount || 0,
    opensCount: profile?.opensCount || 0,
    cityStats: profile?.cityStats,
    districtStats: profile?.districtStats,
    propertyStats: profile?.propertyStats,
    reasonStats: profile?.reasonStats,
  });

  const confidence = profile?.confidence || 0;
  const contradictionIndex = profile?.contradictionIndex || 0;
  const searchPhase = profile?.searchPhase || 'ACTIVE';
  const decisionCount = brief.likesCount + brief.dislikesCount + brief.fastTrackCount;
  const priority = tropes.find((trope) => trope.status === 'SERIOUS' || trope.priority);
  const topCity = brief.topCities[0]?.key || null;

  let intentStage: GuideIntentStage = 'EXPLORE';
  if (searchPhase === 'COMPLETED') intentStage = 'COMPLETE';
  else if (priority || confidence >= 0.55 || brief.fastTrackCount >= 2) intentStage = 'READY';
  else if (decisionCount >= 4 || confidence >= 0.22) intentStage = 'FOCUS';

  let nextStep: EstateOsGuideContext['nextStep'];
  let body: string;
  let primaryCta: GuideCta;
  let secondaryCta: GuideCta;

  if (intentStage === 'COMPLETE') {
    nextStep = {
      key: 'JOURNEY_COMPLETE',
      title: 'Ta faza poszukiwania jest domknięta.',
      action: 'DIRECTION',
    };
    body = 'Możesz wrócić do kierunku, gdy pojawi się nowa potrzeba — bez zaczynania od zera.';
    primaryCta = buildCta('Zobacz mój kierunek', 'DIRECTION');
    secondaryCta = buildCta('Przeglądaj oferty', 'DISCOVERY');
  } else if (priority) {
    nextStep = {
      key: 'SERIOUS_TROPE',
      title: 'Masz trop, który warto spokojnie pogłębić.',
      action: 'TROPES',
      offerId: priority.offerId,
    };
    body = topCity
      ? `Oznaczyłeś coś „na poważnie” w okolicy ${topCity}. Spokojnie zobacz ofertę albo zestaw ją z kierunkiem.`
      : 'Oznaczyłeś coś „na poważnie”. Spokojnie zobacz ofertę albo zestaw ją z kierunkiem.';
    primaryCta = buildCta('Zobacz ofertę', 'TROPES', priority.offerId);
    secondaryCta = buildCta('Mój kierunek', 'DIRECTION');
  } else if (contradictionIndex >= 0.55) {
    nextStep = {
      key: 'CONTRADICTION_CARE',
      title: 'Zwolnijmy — kierunek się miesza.',
      action: 'DIRECTION',
    };
    body =
      'Twoje „pasuje” i „nie dla mnie” trochę się ścierają. Krótki przegląd kierunku pomoże to ułożyć.';
    primaryCta = buildCta('Uporządkuj kierunek', 'DIRECTION');
    secondaryCta = buildCta('Przeglądaj oferty', 'DISCOVERY');
  } else if (intentStage === 'READY') {
    nextStep = {
      key: 'READY_NEXT',
      title: topCity ? `Kierunek wokół ${topCity} jest już wyraźny.` : 'Kierunek jest już wyraźny.',
      action: 'DISCOVERY',
    };
    // Tip only — structured prefs live in summaryLine / profile fields for UI chips.
    body = 'Doprecyzuj katalog albo oznacz coś „na poważnie” — wtedy tropy stają się konkretne.';
    primaryCta = buildCta('Przeglądaj oferty', 'DISCOVERY');
    secondaryCta = buildCta('Mój kierunek', 'DIRECTION');
  } else if (intentStage === 'FOCUS') {
    nextStep = {
      key: 'CONTINUE_DISCOVERY',
      title: topCity ? `Zarys wokół ${topCity} się wyłania.` : 'Twój kierunek robi się wyraźniejszy.',
      action: 'DISCOVERY',
    };
    body =
      'Kilka kolejnych decyzji — zwłaszcza „nie dla mnie” z powodem — mocno ostrzy gust.';
    primaryCta = buildCta('Kontynuuj ocenianie', 'DISCOVERY');
    secondaryCta = buildCta('Mój kierunek', 'DIRECTION');
  } else {
    nextStep = {
      key: 'START_DISCOVERY',
      title: 'Zacznijmy od tego, co coś w Tobie poruszy.',
      action: 'DISCOVERY',
    };
    body =
      'Bez formularza. Na ofertach wybierz Pasuje, Nie dla mnie albo Na poważnie — Intelligence uczy się z tego samo.';
    primaryCta = buildCta('Oceń pierwsze oferty', 'DISCOVERY');
    secondaryCta = buildCta('Mój kierunek', 'DIRECTION');
  }

  // Continuous progress within stage bands — never a fake fixed 82%.
  const stageBand: Record<GuideIntentStage, { floor: number; ceiling: number }> = {
    EXPLORE: { floor: 0.04, ceiling: 0.26 },
    FOCUS: { floor: 0.28, ceiling: 0.54 },
    READY: { floor: 0.56, ceiling: 0.9 },
    COMPLETE: { floor: 0.92, ceiling: 1 },
  };
  const band = stageBand[intentStage];
  const blend = Math.min(1, Math.max(0, confidence * 0.72 + Math.min(0.28, decisionCount * 0.014)));
  const stageProgress = band.floor + (band.ceiling - band.floor) * blend;

  const lastNotes = noteEvents
    .map((row) => String(row.correctionTarget || '').replace(/^note:/, '').trim())
    .filter(Boolean);

  const evidenceBits: string[] = [];
  if (topCity) evidenceBits.push(topCity);
  if (brief.topDistricts[0]?.key) evidenceBits.push(brief.topDistricts[0].key);
  if (brief.topPropertyTypes[0]?.key) {
    evidenceBits.push(
      discoveryPropertyTypeLabel(brief.topPropertyTypes[0].key) ||
        discoveryDisplayLabel(brief.topPropertyTypes[0].key),
    );
  }
  if (brief.preferredBudgetPln) {
    evidenceBits.push(`~${brief.preferredBudgetPln.toLocaleString('pl-PL')} zł`);
  }
  const evidenceHint = evidenceBits.length ? evidenceBits.join(' · ') : null;

  return {
    confidence,
    contradictionIndex,
    profileUpdatedAt: profile?.updatedAt ?? null,
    searchPhase,
    intentStage,
    intentLabel: STAGE_LABEL[intentStage],
    body,
    summaryLine: brief.summaryLine,
    evidenceHint,
    decisionCount,
    tropes,
    knows: {
      city: topCity,
      district: brief.topDistricts[0]?.key || null,
      budgetPln: brief.preferredBudgetPln,
      areaM2: brief.preferredAreaM2,
      transaction: brief.preferredTransaction,
      dislikeReasons: brief.dislikeReasons
        .map((row) => row.key)
        .filter((key) => !key.startsWith('__'))
        .slice(0, 3),
      lastNotes,
    },
    nextStep,
    primaryCta,
    secondaryCta,
    stageProgress,
  };
}
