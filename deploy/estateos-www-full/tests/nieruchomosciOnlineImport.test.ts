import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNieruchomosciOnlineHtml } from '../src/lib/otodomImport';
import { resolveImportSmartAdd } from '../src/lib/otodomImportCreate';
import { inferDistrictForCity } from '../src/lib/portalImportEnrich';
import { listingConfirmedDistrict } from '../src/lib/location/resolveOfferLocationFromCoordinates';

const NIER_ONLINE_LISTING_HTML = `
<html><head>
<title>Sprzedam mieszkanie Warszawa</title>
<meta property="og:description" content="Krótki lead bez parametrów." />
<link rel="canonical" href="https://warszawa.nieruchomosci-online.pl/mieszkanie-w-bloku-mieszkalnym,przy-lesie/26914052.html" />
</head><body>
<strong>Adres:</strong> <span>Szeligowska , Bemowo , Warszawa, Bemowo, mazowieckie</span>
<strong>Powierzchnia dodatkowa:</strong> <span>balkon</span>
<strong>Miejsce parkingowe:</strong> <span>w garażu podziemnym (1 miejsce parkingowe)</span>
<strong>Wyposażenie:</strong> <span>mieszkanie umeblowane , lodówka</span>
<strong>Media:</strong> <span>ogrzewanie: miejskie</span>
<span class="fheader body-sm">Miejsce parkingowe:</span><br/><span class="fsize-c">w garażu podziemnym</span>
<div class="estate-desc-less">Skrót z loggią (...) Rozwiń opis</div>
<div class="estate-desc-more">Idealne mieszkanie na Bemowie. ul. Szeligowska, Bemowo, Warszawa. Przedpokój i loggia, miejsce parkingowe w garażu podziemnym plus box.</div>
<script type="application/ld+json">{"@type":"Offer","price":846000,"itemOffered":{"address":{"streetAddress":"Szeligowska","addressLocality":"Warszawa"}}}</script>
</body></html>
`;

test('N-O parser reads estate-desc-more, balcony and garage fields', () => {
  const draft = parseNieruchomosciOnlineHtml(
    NIER_ONLINE_LISTING_HTML,
    'https://warszawa.nieruchomosci-online.pl/mieszkanie-w-bloku-mieszkalnym,przy-lesie/26914052.html',
  );
  assert.match(draft.descriptionText, /loggia/i);
  assert.match(draft.descriptionText, /Bemowo/i);
  assert.ok(draft.features.some((item) => /balkon/i.test(item)));
  assert.ok(draft.features.some((item) => /parking|gara/i.test(item)));
  assert.equal(draft.district, 'Bemowo');
});

test('N-O import smart-add marks balcony, parking and furnished like other portals', () => {
  const draft = parseNieruchomosciOnlineHtml(
    NIER_ONLINE_LISTING_HTML,
    'https://warszawa.nieruchomosci-online.pl/mieszkanie-w-bloku-mieszkalnym,przy-lesie/26914052.html',
  );
  const smart = resolveImportSmartAdd({ draft });
  assert.equal(smart.amenities.hasBalcony, true);
  assert.equal(smart.amenities.hasParking, true);
  assert.equal(smart.amenities.isFurnished, true);
});

test('listing text Bemowo wins over a street that the catalog would put in another district', () => {
  assert.equal(
    inferDistrictForCity('Warszawa', {
      district: '',
      neighborhood: '',
      street: 'Szeligowska 8',
      title: 'Mieszkanie na Bemowie',
      descriptionText: 'ul. Szeligowska, Bemowo, Warszawa. Loggia i garaż.',
      externalUrl: '',
    }),
    'Bemowo',
  );
  assert.equal(
    listingConfirmedDistrict('Warszawa', {
      district: 'Bemowo',
      neighborhood: 'Szeligowska , Bemowo',
      title: 'Mieszkanie na sprzedaż',
      descriptionText: 'Lokalizacja: Bemowo, Warszawa.',
    }),
    'Bemowo',
  );
});
