import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendarIcs, googleCalendarUrl, toUtcStamp } from '../src/lib/crm/calendarLinks';

test('google calendar url uses UTC date stamps', () => {
  const startsAt = new Date('2026-09-05T13:00:00.000Z');
  const url = googleCalendarUrl({
    title: 'Prezentacja nieruchomości',
    startsAt,
    location: 'Wilanów',
  });
  assert.match(url, /calendar\.google\.com/);
  assert.match(url, /20260905T130000Z/);
  assert.match(url, /Wilan/);
});

test('ics file contains event summary and location', () => {
  const ics = buildCalendarIcs({
    title: 'Prezentacja nieruchomości',
    startsAt: new Date('2026-09-05T13:00:00.000Z'),
    location: 'Wilanów',
    uid: 'test-uid@estateos.pl',
  });
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /SUMMARY:Prezentacja nieruchomości/);
  assert.match(ics, /LOCATION:Wilanów/);
  assert.equal(toUtcStamp(new Date('2026-09-05T13:00:00.000Z')), '20260905T130000Z');
});
