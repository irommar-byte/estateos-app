/**
 * Poprawka tekstu oferty zapisanej ze złym miastem: „w Białymstoku” → „w Warszawie”,
 * „centrum Białegostoku” → „centrum Warszawy”, „Łódź” → „Warszawa”.
 * Tylko całe słowa (polskie litery), tylko formy miasta — nazwy dzielnic i ulic zostają.
 */
type CityForms = { nom: string; gen: string; loc: string };

const CITY_FORMS: Record<string, CityForms> = {
  'Białystok': { nom: 'Białystok', gen: 'Białegostoku', loc: 'Białymstoku' },
  'Łódź': { nom: 'Łódź', gen: 'Łodzi', loc: 'Łodzi' },
  'Gdańsk': { nom: 'Gdańsk', gen: 'Gdańska', loc: 'Gdańsku' },
  'Gdynia': { nom: 'Gdynia', gen: 'Gdyni', loc: 'Gdyni' },
  'Rybnik': { nom: 'Rybnik', gen: 'Rybnika', loc: 'Rybniku' },
  'Poznań': { nom: 'Poznań', gen: 'Poznania', loc: 'Poznaniu' },
  'Kraków': { nom: 'Kraków', gen: 'Krakowa', loc: 'Krakowie' },
  'Wrocław': { nom: 'Wrocław', gen: 'Wrocławia', loc: 'Wrocławiu' },
  'Katowice': { nom: 'Katowice', gen: 'Katowic', loc: 'Katowicach' },
  'Lublin': { nom: 'Lublin', gen: 'Lublina', loc: 'Lublinie' },
  'Szczecin': { nom: 'Szczecin', gen: 'Szczecina', loc: 'Szczecinie' },
  'Bydgoszcz': { nom: 'Bydgoszcz', gen: 'Bydgoszczy', loc: 'Bydgoszczy' },
  'Toruń': { nom: 'Toruń', gen: 'Torunia', loc: 'Toruniu' },
  'Kielce': { nom: 'Kielce', gen: 'Kielc', loc: 'Kielcach' },
  'Rzeszów': { nom: 'Rzeszów', gen: 'Rzeszowa', loc: 'Rzeszowie' },
  'Olsztyn': { nom: 'Olsztyn', gen: 'Olsztyna', loc: 'Olsztynie' },
  'Opole': { nom: 'Opole', gen: 'Opola', loc: 'Opolu' },
  'Mińsk Mazowiecki': { nom: 'Mińsk Mazowiecki', gen: 'Mińska Mazowieckiego', loc: 'Mińsku Mazowieckim' },
};

const WARSAW: CityForms = { nom: 'Warszawa', gen: 'Warszawy', loc: 'Warszawie' };

const word = (form: string) => form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
const L = '\\p{L}';

export function hasCityTextForms(city: string): boolean {
  return Boolean(CITY_FORMS[city]);
}

export function replaceWrongCityInText(text: string, wrongCity: string, target: CityForms = WARSAW): string {
  const forms = CITY_FORMS[wrongCity];
  if (!text || !forms) return text;
  let out = text;
  // „w/we Białymstoku” → „w Warszawie”
  out = out.replace(new RegExp(`(?<!${L})([Ww])e?(\\s+)${word(forms.loc)}(?!${L})`, 'gu'), `$1$2${target.loc}`);
  if (forms.gen !== forms.loc) {
    out = out.replace(new RegExp(`(?<!${L})${word(forms.gen)}(?!${L})`, 'gu'), target.gen);
    out = out.replace(new RegExp(`(?<!${L})${word(forms.loc)}(?!${L})`, 'gu'), target.loc);
  } else {
    // Ta sama forma dopełniacza i miejscownika (Łodzi) bez „w” → dopełniacz: „w sercu Łodzi” → „w sercu Warszawy”.
    out = out.replace(new RegExp(`(?<!${L})${word(forms.gen)}(?!${L})`, 'gu'), target.gen);
  }
  out = out.replace(new RegExp(`(?<!${L})${word(forms.nom)}(?!${L})`, 'gu'), target.nom);
  return out;
}
