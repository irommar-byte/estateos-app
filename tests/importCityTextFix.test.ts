import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceWrongCityInText } from '@/lib/importCityTextFix';
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
