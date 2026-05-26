import {
  findLatestActionableAppointmentEvent,
  findLatestActionableBidEvent,
  isMessageFromUser,
  resolveEventBidId,
} from '../../src/utils/dealBidNegotiation';

describe('dealBidNegotiation', () => {
  it('uses chronologically latest pending bid and skips own counter', () => {
    const events = [
      {
        msg: { senderId: 2 },
        event: { action: 'PROPOSED', amount: 2800, bidId: 10 },
      },
      {
        msg: { senderId: 1 },
        event: { action: 'COUNTERED', amount: 2000, bidId: 12 },
      },
    ];
    expect(findLatestActionableBidEvent(events, 1)).toBeNull();
    expect(findLatestActionableBidEvent(events, 2)?.event?.bidId).toBe(12);
  });

  it('does not treat missing senderId as own message', () => {
    expect(isMessageFromUser({ senderId: undefined }, 5)).toBe(false);
    expect(isMessageFromUser({ senderId: 5 }, 5)).toBe(true);
  });

  it('resolves bid id only from bidId field', () => {
    expect(resolveEventBidId({ bidId: 7, id: 99 })).toBe(7);
    expect(resolveEventBidId({ id: 99 })).toBe(null);
  });

  it('returns null when latest bid is own counter (cannot accept self)', () => {
    const events = [
      {
        msg: { senderId: 2 },
        event: { action: 'PROPOSED', amount: 3000, bidId: 10 },
      },
      {
        msg: { senderId: 1 },
        event: { action: 'COUNTERED', amount: 2800, bidId: 11 },
      },
    ];
    expect(findLatestActionableBidEvent(events, 1)).toBeNull();
    expect(findLatestActionableBidEvent(events, 2)?.event?.bidId).toBe(11);
  });

  it('returns null when latest appointment is own proposal', () => {
    const events = [
      {
        msg: { senderId: 2 },
        event: { action: 'PROPOSED', proposedDate: '2026-06-01T10:30:00.000Z' },
      },
      {
        msg: { senderId: 1 },
        event: { action: 'COUNTERED', proposedDate: '2026-06-03T11:00:00.000Z' },
      },
    ];
    expect(findLatestActionableAppointmentEvent(events, 1)).toBeNull();
    expect(findLatestActionableAppointmentEvent(events, 2)?.event?.proposedDate).toContain('2026-06-03');
  });
});
