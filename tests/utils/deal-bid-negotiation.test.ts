import {
  findLatestActionableBidEvent,
  isMessageFromUser,
  resolveEventBidId,
} from '../../src/utils/dealBidNegotiation';

describe('dealBidNegotiation', () => {
  it('ignores events without senderId when finding actionable bid', () => {
    const events = [
      {
        msg: { senderId: 2 },
        event: { action: 'PROPOSED', amount: 2800, bidId: 10 },
      },
      {
        msg: {},
        event: { action: 'COUNTERED', amount: 2000, bidId: 12 },
      },
    ];
    const found = findLatestActionableBidEvent(events, 1);
    expect(found?.event?.bidId).toBe(10);
  });

  it('does not treat missing senderId as own message', () => {
    expect(isMessageFromUser({ senderId: undefined }, 5)).toBe(false);
    expect(isMessageFromUser({ senderId: 5 }, 5)).toBe(true);
  });

  it('resolves bid id only from bidId field', () => {
    expect(resolveEventBidId({ bidId: 7, id: 99 })).toBe(7);
    expect(resolveEventBidId({ id: 99 })).toBe(null);
  });
});
