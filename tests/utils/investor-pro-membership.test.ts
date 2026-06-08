import {
  buildProMembershipCountdown,
  hasActiveInvestorProMembership,
} from '../../src/utils/investorProMembership';

describe('investorProMembership', () => {
  it('detects active pro with future expiry', () => {
    const future = new Date(Date.now() + 10 * 86400000).toISOString();
    expect(
      hasActiveInvestorProMembership({
        planType: 'INVESTOR_PRO',
        isPro: true,
        proExpiresAt: future,
      })
    ).toBe(true);
  });

  it('rejects expired pro', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(
      hasActiveInvestorProMembership({
        planType: 'PRO',
        isPro: true,
        proExpiresAt: past,
      })
    ).toBe(false);
  });

  it('builds countdown with remaining-time progress', () => {
    const future = new Date(Date.now() + 15 * 86400000).toISOString();
    const c = buildProMembershipCountdown(future);
    expect(c?.daysLeft).toBe(15);
    expect(c?.progress).toBeGreaterThanOrEqual(0.45);
    expect(c?.progress).toBeLessThanOrEqual(0.55);
  });

  it('aligns bar fill with days left at period start', () => {
    const future = new Date(Date.now() + 30 * 86400000).toISOString();
    const c = buildProMembershipCountdown(future);
    expect(c?.daysLeft).toBe(30);
    expect(c?.progress).toBeGreaterThanOrEqual(0.95);
  });

  it('shows low fill when renewal is near', () => {
    const future = new Date(Date.now() + 2 * 86400000).toISOString();
    const c = buildProMembershipCountdown(future);
    expect(c?.daysLeft).toBeLessThanOrEqual(2);
    expect(c?.progress).toBeLessThanOrEqual(0.1);
  });
});
