import {
  canFinalizeTransition,
  detectFinalAcceptanceContext,
  isDealTransactionFinalized,
} from '../../deploy/estateos-www-full/src/lib/dealPriceNegotiationUi';

describe('dealPriceNegotiationUi', () => {
  it('treats AGREED as not finalized until FINALIZED status', () => {
    expect(isDealTransactionFinalized({ dealStatus: 'AGREED' })).toBe(false);
    expect(isDealTransactionFinalized({ dealStatus: 'FINALIZED' })).toBe(true);
    expect(canFinalizeTransition({ dealStatus: 'AGREED', acceptedBidId: 12 })).toBe(true);
  });

  it('detects buyer final acceptance counter at same amount', () => {
    const ctx = detectFinalAcceptanceContext([
      {
        msg: { senderId: 10 },
        event: {
          action: 'PROPOSED',
          amount: 500000,
          bidId: 1,
        },
      },
      {
        msg: { senderId: 20 },
        event: {
          action: 'COUNTERED',
          amount: 500000,
          bidId: 2,
          intent: 'FINAL_ACCEPTANCE',
          note: 'Akceptuję Twoją cenę. Proszę o ostateczne potwierdzenie sprzedaży.',
        },
      },
    ]);
    expect(ctx?.bidId).toBe(2);
    expect(ctx?.amount).toBe(500000);
    expect(ctx?.buyerSenderId).toBe('20');
  });
});
