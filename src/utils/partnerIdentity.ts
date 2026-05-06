export function isPartnerIdentity(input: any): boolean {
  const candidates = [
    input?.role,
    input?.userRole,
    input?.accountType,
    input?.planType,
    input?.type,
    input?.user?.role,
    input?.user?.userRole,
    input?.user?.accountType,
    input?.user?.planType,
    input?.owner?.role,
    input?.owner?.accountType,
    input?.owner?.planType,
    input?.seller?.role,
    input?.seller?.accountType,
    input?.seller?.planType,
  ]
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean);

  if (input?.isPartner === true || input?.partner === true) return true;
  return candidates.some(
    (x) => x === 'AGENT' || x === 'PARTNER' || x === 'AGENCY' || x === 'BROKER'
  );
}

export function isInvestorProIdentity(input: any): boolean {
  const candidates = [
    input?.planType,
    input?.subscriptionPlan,
    input?.subscriptionTier,
    input?.tier,
    input?.type,
    input?.user?.planType,
    input?.user?.subscriptionPlan,
    input?.user?.subscriptionTier,
    input?.user?.tier,
    input?.user?.type,
  ]
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean);

  if (input?.isPro === true || input?.user?.isPro === true) return true;

  const subscriptionStatus = String(input?.subscriptionStatus || input?.user?.subscriptionStatus || '')
    .trim()
    .toUpperCase();
  if (
    ['ACTIVE', 'TRIALING', 'PAID', 'OK'].includes(subscriptionStatus) &&
    candidates.some((x) => x.includes('PRO'))
  ) {
    return true;
  }

  return candidates.some(
    (x) => x === 'INVESTOR_PRO' || x === 'PRO' || x === 'INVESTOR-PRO' || x === 'INVESTOR PRO'
  );
}
