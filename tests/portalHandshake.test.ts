import test from 'node:test';
import assert from 'node:assert/strict';
import { portalStackKind } from '../src/lib/portalActivityStacks';
import { collectAgentOfferReplies } from '../src/utils/clientPortalFeedback';
import { computeBuyerPipeline, buyerPipelineFromClientDetail } from '../src/lib/sellerClientPipeline';

test('portal stacks map real presentation and sale event kinds', () => {
  assert.equal(portalStackKind('PRESENTATION_PROPOSED'), 'presentations');
  assert.equal(portalStackKind('OPEN_HOUSE_CONFIRMED'), 'presentations');
  assert.equal(portalStackKind('AUCTION_PROPOSAL'), 'presentations');
});

test('collects unread agent replies for the buyer inbox', () => {
  const rows = collectAgentOfferReplies([
    {
      id: 11,
      clientFeedback: JSON.stringify({
        note: 'Czy jest parking?',
        agentReply: 'Tak, miejsce w hali.',
        agentReplyAt: '2026-09-04T10:00:00.000Z',
      }),
      offer: { id: 88, title: 'Bemowo', imageUrl: null },
    },
    {
      id: 12,
      clientFeedback: JSON.stringify({ sentiment: 'like', note: 'ok' }),
      offer: { id: 89, title: 'Wola', imageUrl: null },
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].matchId, 11);
  assert.equal(rows[0].unread, true);
  assert.match(rows[0].agentReply, /hali/);
});

test('buyer pipeline uses sentCount and dealClosed from the client record', () => {
  const stages = computeBuyerPipeline({
    hasCriteria: true,
    hasMatches: true,
    hasSent: true,
    presentationConfirmed: false,
    dealClosed: true,
  });
  assert.equal(stages.find((s) => s.id === 'sending')?.done, true);
  assert.equal(stages.find((s) => s.id === 'deal')?.done, true);

  const fromDetail = buyerPipelineFromClientDetail({
    sentCount: 4,
    dealClosed: true,
    matches: [],
    presentation: { status: 'confirmed' },
  } as Parameters<typeof buyerPipelineFromClientDetail>[0]);
  assert.equal(fromDetail.find((s) => s.id === 'sending')?.done, true);
  assert.equal(fromDetail.find((s) => s.id === 'deal')?.done, true);
  assert.equal(fromDetail.find((s) => s.id === 'presentation')?.done, true);
});
