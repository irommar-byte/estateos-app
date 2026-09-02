import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBuyerAgentTasks } from '../src/lib/crm/buyerAgentTasks';
import { serializeClientOfferFeedback } from '../src/lib/crm/clientPortalFeedback';

test('shows maybe note as an actionable agent question', () => {
  const tasks = buildBuyerAgentTasks(
    [
      {
        id: 12,
        clientFeedback: serializeClientOfferFeedback({
          sentiment: 'maybe',
          note: 'Sprawdź proszę, czy można dokupić miejsce postojowe.',
        }),
        clientFeedbackAt: '2026-09-01T11:39:57.348Z',
        offer: { id: 1338, title: 'Mieszkanie na Bemowie' },
      },
    ],
    [
      {
        id: 44,
        kind: 'CLIENT_FEEDBACK',
        title: 'Reakcja klienta',
        body: null,
        offerId: 1338,
        createdAt: '2026-09-01T11:39:57.348Z',
        metadata: { matchId: 12 },
      },
    ],
  );

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].kind, 'question');
  assert.equal(tasks[0].offerId, 1338);
  assert.match(tasks[0].body, /miejsce postojowe/i);
});

test('viewing intent is urgent and handled activities disappear', () => {
  const match = {
    id: 13,
    clientFeedback: serializeClientOfferFeedback({ sentiment: 'like' as const }),
    clientFeedbackAt: '2026-09-02T10:00:00.000Z',
    offer: { id: 1400, title: 'Mieszkanie na Woli' },
  };
  const activity = {
    id: 45,
    kind: 'CLIENT_FEEDBACK',
    title: 'Reakcja klienta',
    body: null,
    offerId: 1400,
    createdAt: '2026-09-02T10:00:00.000Z',
    metadata: { matchId: 13 },
  };

  assert.equal(buildBuyerAgentTasks([match], [activity])[0].kind, 'viewing');
  assert.equal(
    buildBuyerAgentTasks([match], [{ ...activity, metadata: { matchId: 13, agentStatus: 'done' } }]).length,
    0,
  );
});

test('handoff replaces a duplicate feedback task for the same match', () => {
  const tasks = buildBuyerAgentTasks(
    [
      {
        id: 14,
        clientFeedback: serializeClientOfferFeedback({
          sentiment: 'maybe',
          note: 'Czy można dokupić parking?',
        }),
        clientFeedbackAt: '2026-09-02T11:00:00.000Z',
        offer: { id: 1500, title: 'Mieszkanie' },
      },
    ],
    [
      {
        id: 46,
        kind: 'CLIENT_FEEDBACK',
        title: 'Reakcja klienta',
        body: null,
        offerId: 1500,
        createdAt: '2026-09-02T11:00:00.000Z',
        metadata: { matchId: 14 },
      },
      {
        id: 47,
        kind: 'INTELLIGENCE_HANDOFF',
        title: 'Klient prosi o sprawdzenie',
        body: 'Sprawdź dostępność miejsca postojowego i wróć z odpowiedzią.',
        offerId: 1500,
        createdAt: '2026-09-02T11:00:01.000Z',
        metadata: { matchId: 14 },
      },
    ],
  );

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].activityId, 47);
  assert.equal(tasks[0].kind, 'handoff');
});
