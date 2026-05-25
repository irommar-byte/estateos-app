import { isAgentRoleIdentity, isPartnerIdentity } from '@/utils/partnerIdentity';

export type EliteBadges = {
  isAdmin: boolean;
  isAgent: boolean;
  isProgramPartner: boolean;
  isInvestorPro: boolean;
};

const INVESTOR_PRO_VALUES = new Set(['INVESTOR_PRO', 'PRO', 'INVESTOR-PRO', 'INVESTOR PRO']);
const INVESTOR_PRO_SUBSCRIPTION_VALUES = new Set(['ACTIVE', 'TRIALING', 'PAID', 'OK']);

const INVESTOR_PLAN_PATHS = [
  'plan',
  'planType',
  'tier',
  'subscriptionPlan',
  'user.plan',
  'user.planType',
  'user.tier',
  'user.subscriptionPlan',
];

const INVESTOR_SUBSCRIPTION_STATUS_PATHS = [
  'subscriptionStatus',
  'status',
  'paymentStatus',
  'subscription.status',
  'subscription.subscriptionStatus',
  'user.subscriptionStatus',
  'user.subscription.status',
];

function normalizeValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/_/g, '_');
}

function getPathValue(subject: any, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc === null || acc === undefined) return undefined;
    if (typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[part];
  }, subject);
}

function firstBoolean(subject: any, paths: string[]): boolean {
  for (const path of paths) {
    const value = getPathValue(subject, path);
    if (typeof value === 'boolean') return value;
  }
  return false;
}

function valuesFromPaths(subject: any, paths: string[]): string[] {
  const values: string[] = [];
  for (const path of paths) {
    const value = getPathValue(subject, path);
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number') {
      values.push(normalizeValue(value));
    }
  }
  return values;
}

/** Plakietki zgodne z aplikacją mobilną — Agent ≠ Partner. */
export function resolveEliteBadges(subject: any): EliteBadges {
  if (!subject || typeof subject !== 'object') {
    return { isAdmin: false, isAgent: false, isProgramPartner: false, isInvestorPro: false };
  }

  const role = normalizeValue(subject.role ?? subject.user?.role);
  const isAdmin = role === 'ADMIN';
  const isAgent = isAgentRoleIdentity(subject);
  const isProgramPartner =
    !isAdmin && !isAgent && isPartnerIdentity(subject);

  const explicitPro = firstBoolean(subject, ['isPro', 'user.isPro']);
  const investorPlanTokens = valuesFromPaths(subject, INVESTOR_PLAN_PATHS);
  const hasInvestorProPlan = investorPlanTokens.some((token) => INVESTOR_PRO_VALUES.has(token));
  const hasPlanContainingPro = investorPlanTokens.some((token) => token.includes('PRO'));
  const subscriptionStatusTokens = valuesFromPaths(subject, INVESTOR_SUBSCRIPTION_STATUS_PATHS);
  const hasActiveSubscriptionStatus = subscriptionStatusTokens.some((token) =>
    INVESTOR_PRO_SUBSCRIPTION_VALUES.has(token),
  );
  const isInvestorPro =
    explicitPro || hasInvestorProPlan || (hasActiveSubscriptionStatus && hasPlanContainingPro);

  return {
    isAdmin,
    isAgent,
    isProgramPartner,
    isInvestorPro,
  };
}
