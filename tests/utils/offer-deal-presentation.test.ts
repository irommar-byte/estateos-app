import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveOfferDealPresentation,
  parseAgreedPriceFromSaleFinalizationMessage,
} from '../../src/utils/offerDealPresentation';

test('parseAgreedPriceFromSaleFinalizationMessage', () => {
  const msg =
    'Decyzja właściciela: ostatecznie akceptuję cenę 610 000 PLN i zamykam sprzedaż. Oferta została wycofana z rynku.';
  assert.equal(parseAgreedPriceFromSaleFinalizationMessage(msg), 610000);
});

test('deriveOfferDealPresentation — sfinalizowana sprzedaż', () => {
  const pres = deriveOfferDealPresentation({
    dealStatus: 'FINALIZED',
    messages: [
      {
        content:
          'Decyzja właściciela: ostatecznie akceptuję cenę 610 000 PLN i zamykam sprzedaż. Oferta została wycofana z rynku.',
      },
    ],
  });
  assert.equal(pres.transactionFinalized, true);
  assert.equal(pres.agreedPrice, 610000);
  assert.equal(pres.priceNegotiation?.title, 'Transakcja sfinalizowana');
  assert.equal(pres.shouldHideBuyerNegotiationButtons, true);
});

test('deriveOfferDealPresentation — kupujący zaakceptował, nie COUNTERED jako w negocjacji', () => {
  const event = (action: string, amount: number, note?: string) =>
    '[[DEAL_EVENT]]' +
    JSON.stringify({
      entity: 'BID',
      action,
      status: 'PENDING',
      amount,
      ...(note ? { note } : {}),
    });
  const pres = deriveOfferDealPresentation({
    dealStatus: 'AGREED',
    acceptedBidId: 12,
    messages: [
      { senderId: 1, content: event('PROPOSED', 600000) },
      {
        senderId: 2,
        content: event(
          'COUNTERED',
          600000,
          'Akceptuję Twoją cenę. Proszę o ostateczne potwierdzenie sprzedaży.',
        ),
      },
    ],
  });
  assert.equal(pres.transactionFinalized, false);
  assert.equal(pres.agreedPrice, 600000);
  assert.equal(pres.priceNegotiation?.title, 'Cena: uzgodniona');
  assert.equal(pres.shouldHideBuyerNegotiationButtons, true);
});
