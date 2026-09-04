import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHandoffAgentNote,
  buildHandoffClientMessage,
  presentPortalChatFields,
  stripClientFeedbackPrefix,
} from '../src/lib/crm/portalChatCopy';
import { parsePortalMessages, JOURNEY_ACTIVITY } from '../src/lib/crm/clientJourney';

test('strips the legacy reaction prefix from the client bubble', () => {
  const stripped = stripClientFeedbackPrefix(
    'Reakcja do oferty „Atrakcyjne mieszkanie na Sadybie”:\nCzy jutro o godzinie dwunastej możemy obejrzeć?',
  );
  assert.equal(stripped.offerTitle, 'Atrakcyjne mieszkanie na Sadybie');
  assert.equal(stripped.content, 'Czy jutro o godzinie dwunastej możemy obejrzeć?');
});

test('client sees numbered next steps instead of the internal handoff log', () => {
  const presented = presentPortalChatFields({
    content:
      'Marian — Klient kliknął „Chcę oglądać” — wybierz termin prezentacji i skontaktuj się z nim. Wrócę z konkretem po rozmowie — na ten moment wstrzymuję automatyczne dokładanie kolejnej oferty.',
    fromAgent: true,
    viewer: 'client',
  });
  assert.equal(presented.visible, true);
  assert.equal(presented.kind, 'client_step');
  assert.match(presented.content, /Co teraz zrób:/);
  assert.match(presented.content, /obejrzeć/i);
  assert.doesNotMatch(presented.content, /Klient kliknął/);
  assert.doesNotMatch(presented.content, /wstrzymuję automatyczne/i);
});

test('agent still sees the operational note on a legacy handoff', () => {
  const presented = presentPortalChatFields({
    content: 'Marian — Klient kliknął „Chcę oglądać” — wybierz termin prezentacji i skontaktuj się z nim.',
    fromAgent: true,
    viewer: 'agent',
  });
  assert.equal(presented.kind, 'agent_note');
  assert.match(presented.content, /Chcę oglądać/);
  assert.match(presented.content, /termin prezentacji/);
});

test('agent-only notes are hidden from the client viewer', () => {
  const presented = presentPortalChatFields({
    content: buildHandoffAgentNote('Klient kliknął „Chcę oglądać” — wybierz termin prezentacji.', 'Marian'),
    fromAgent: true,
    viewer: 'client',
    audience: 'agent',
    kind: 'agent_note',
  });
  assert.equal(presented.visible, false);
});

test('new client handoff copy is a concrete next step', () => {
  const body = buildHandoffClientMessage('viewing');
  assert.match(body, /1\. /);
  assert.match(body, /termin/i);
  assert.doesNotMatch(body, /Klient kliknął/);
});

test('parsePortalMessages hides agent-only rows from the client', () => {
  const rows = [
    {
      id: 1,
      kind: JOURNEY_ACTIVITY.PORTAL_MESSAGE,
      title: 'Wiadomość od klienta',
      body: 'Czy jutro o 12?',
      createdAt: '2026-09-04T13:25:00.000Z',
      metadata: {
        from: 'client',
        content: 'Reakcja do oferty „Sadyba”:\nCzy jutro o 12?',
        offerTitle: 'Sadyba',
        attachments: [],
      },
    },
    {
      id: 2,
      kind: JOURNEY_ACTIVITY.PORTAL_MESSAGE,
      title: 'Notatka dla agenta',
      body: 'Wybierz termin',
      createdAt: '2026-09-04T13:25:10.000Z',
      metadata: {
        from: 'agent',
        audience: 'agent',
        kind: 'agent_note',
        content: 'Klient kliknął „Chcę oglądać” — wybierz termin prezentacji.',
        attachments: [],
      },
    },
    {
      id: 3,
      kind: JOURNEY_ACTIVITY.PORTAL_MESSAGE,
      title: 'Wiadomość do klienta',
      body: 'Rozumiem',
      createdAt: '2026-09-04T13:25:05.000Z',
      metadata: {
        from: 'agent',
        audience: 'both',
        kind: 'client_step',
        content: buildHandoffClientMessage('viewing'),
        attachments: [],
      },
    },
  ];

  const forClient = parsePortalMessages(rows, 'client');
  assert.equal(forClient.length, 2);
  assert.equal(forClient[0].content, 'Czy jutro o 12?');
  assert.equal(forClient[0].offerTitle, 'Sadyba');
  assert.equal(forClient[1].kind, 'client_step');
  assert.ok(forClient.every((row) => row.kind !== 'agent_note'));

  const forAgent = parsePortalMessages(rows, 'agent');
  assert.equal(forAgent.length, 3);
  assert.ok(forAgent.some((row) => row.kind === 'agent_note'));
});
