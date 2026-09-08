import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapReportEmailWithPortal } from '../../src/lib/market/reportEmailWrap';

test('client email wraps the letter with a portal button', () => {
  const html = wrapReportEmailWithPortal(
    '<!doctype html><html><body><p>Raport</p></body></html>',
    'https://estateos.pl/klient/abc/raport/44',
  );
  assert.match(html, /Otwórz raport w panelu/);
  assert.match(html, /https:\/\/estateos.pl\/klient\/abc\/raport\/44/);
  assert.match(html, /Dokument zapisaliśmy też w Państwa panelu/);
  assert.match(html, /<p>Raport<\/p>/);
});

test('no portal url leaves the letter unchanged', () => {
  const src = '<body>ok</body>';
  assert.equal(wrapReportEmailWithPortal(src, ''), src);
});
