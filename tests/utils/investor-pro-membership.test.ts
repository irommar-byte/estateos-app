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

  it('builds countdown with progress', () => {
    const future = new Date(Date.now() + 15 * 86400000).toISOString();
    const c = buildProMembershipCountdown(future);
    expect(c?.daysLeft).toBeGreaterThan(0);
    expect(c?.progress).toBeGreaterThan(0);
    expect(c?.progress).toBeLessThanOrEqual(1);
  });
});
