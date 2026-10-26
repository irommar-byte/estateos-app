import test from 'node:test';
import assert from 'node:assert/strict';
import { replacePlaceAfterWarsaw, replaceWrongCityInText } from '@/lib/importCityTextFix';
import { repairKeiAddress, titleCasePlace } from '@/lib/keiWarsawGeocode';
import { pinKeiDraftToWarsaw, resolveWarsawDistrict } from '@/lib/keiAmerDistrict';

test('tytuł: miejscownik, dopełniacz i mianownik zamienione na Warszawę', () => {
  assert.equal(replaceWrongCityInText('Mieszkanie na sprzedaż w Białymstoku - Saska Kępa', 'Białystok'), 'Mieszkanie na sprzedaż w Warszawie - Saska Kępa');
  assert.equal(replaceWrongCityInText('Atrakcyjne mieszkanie w centrum Białegostoku', 'Białystok'), 'Atrakcyjne mieszkanie w centrum Warszawy');
  assert.equal(replaceWrongCityInText('Mieszkanie w Łodzi, Bródno', 'Łódź'), 'Mieszkanie w Warszawie, Bródno');
  assert.equal(replaceWrongCityInText('Mieszkanie w sercu Łodzi', 'Łódź'), 'Mieszkanie w sercu Warszawy');
  assert.equal(replaceWrongCityInText('Kawalerka we Wrocławiu', 'Wrocław'), 'Kawalerka w Warszawie');
  assert.equal(replaceWrongCityInText('<p>Gdańsk, Osowa — cisza.</p>', 'Gdańsk'), '<p>Warszawa, Osowa — cisza.</p>');
});

test('nie rusza słów, które tylko zawierają nazwę miasta', () => {
  assert.equal(replaceWrongCityInText('Rybnikowa 5, Łodzianka', 'Rybnik'), 'Rybnikowa 5, Łodzianka');
  assert.equal(replaceWrongCityInText('Ulica Łódzka 3', 'Łódź'), 'Ulica Łódzka 3');
});

test('dzielnica: numer KEI odrzucony, nazwa z adresu wygrywa', () => {
  assert.equal(resolveWarsawDistrict('13', 'Centrum', 'Wawer'), 'Wawer');
  const draft = pinKeiDraftToWarsaw({ city: 'Białystok', district: 'Centrum', lat: 52.2297, lng: 21.0122 }, { address: 'warszawa, praga-południe, saska kępa', district: '6' });
  assert.equal(draft.city, 'Warszawa');
  assert.equal(draft.district, 'Praga-Południe');
});

test('bez adresu KEI i z pinezką poza Warszawą — nic nie zmieniamy', () => {
  const draft = pinKeiDraftToWarsaw({ city: 'Mińsk Mazowiecki', district: null, lat: 52.18, lng: 21.57 }, { address: '', district: '3' });
  assert.equal(draft.city, 'Mińsk Mazowiecki');
});

test('adres KEI w Warszawie wygrywa nawet z pinezką w Białymstoku', () => {
  const draft = pinKeiDraftToWarsaw({ city: 'Białystok', district: 'Centrum', lat: 53.132706, lng: 23.157434 }, { address: 'warszawa, wawer, międzylesie', district: '13' });
  assert.equal(draft.city, 'Warszawa');
  assert.equal(draft.district, 'Wawer');
});

test('osiedle wymyślone pod złe miasto zamienione na osiedle z KEI', () => {
  assert.equal(replacePlaceAfterWarsaw('Na sprzedaż mieszkanie w Warszawie, Kamień - 38 m²', 'Kamień', 'Mirów'), 'Na sprzedaż mieszkanie w Warszawie, Mirów - 38 m²');
  assert.equal(replacePlaceAfterWarsaw('Apartament w Warszawie, Kamieniu', 'Kamień', 'Mirów'), 'Apartament w Warszawie, Mirów');
  assert.equal(replacePlaceAfterWarsaw('Kawalerka w Warszawie, Centrum', 'Centrum', 'Śródmieście Północne'), 'Kawalerka w Warszawie, Śródmieście Północne');
  // „w centrum Warszawy” (bez przecinka) zostaje
  assert.equal(replacePlaceAfterWarsaw('Mieszkanie w centrum Warszawy', 'Centrum', 'Solec'), 'Mieszkanie w centrum Warszawy');
});

test('zepsute polskie litery w adresie KEI', () => {
  assert.equal(repairKeiAddress('warszawa, praga-po?udnie, grochów, garwoli?ska'), 'warszawa, praga-południe, grochów, garwoliska');
  assert.equal(titleCasePlace('śródmieście północne'), 'Śródmieście Północne');
  assert.equal(titleCasePlace('praga-południe'), 'Praga-Południe');
});

test('stare adresy KEI bez polskich liter i z encjami HTML', () => {
  assert.equal(repairKeiAddress('warszawa, śródmieście, ródmiecie pónocne, niecaa').split(', ')[1], 'śródmieście');
  assert.equal(repairKeiAddress('warszawa, bielany, piaski, zgrupowania ak &quot;żmija&quot;'), 'warszawa, bielany, piaski, zgrupowania ak "żmija"');
});
