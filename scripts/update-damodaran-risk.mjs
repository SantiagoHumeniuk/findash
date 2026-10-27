// Regenerates src/data/damodaran-country-risk.json from Aswath Damodaran's public
// country risk premium table (the same source FMP's market-risk-premium used).
// Damodaran updates it in January and July: run `node scripts/update-damodaran-risk.mjs`.

import { writeFileSync } from 'node:fs';

const SOURCE_URL = 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/ctryprem.html';
const OUTPUT = new URL('../src/data/damodaran-country-risk.json', import.meta.url);

const CONTINENTS = {
  Africa: [
    'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Cameroon', 'Cape Verde', 'Congo (Democratic Republic of)',
    'Congo (Republic of)', "Côte d'Ivoire", 'Egypt', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau',
    'Kenya', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger',
    'Nigeria', 'Rwanda', 'Senegal', 'Sierra Leone', 'Somalia', 'South Africa', 'Sudan', 'Swaziland', 'Tanzania', 'Togo',
    'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe',
  ],
  Asia: [
    'Abu Dhabi', 'Armenia', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Brunei', 'Cambodia', 'China', 'Georgia', 'Hong Kong',
    'India', 'Indonesia', 'Iran', 'Iraq', 'Israel', 'Japan', 'Jordan', 'Kazakhstan', 'South Korea', 'North Korea', 'Kuwait',
    'Kyrgyzstan', 'Laos', 'Lebanon', 'Macao', 'Malaysia', 'Maldives', 'Mongolia', 'Myanmar', 'Nepal', 'Oman', 'Pakistan',
    'Philippines', 'Qatar', 'Ras Al Khaimah (Emirate of)', 'Saudi Arabia', 'Sharjah', 'Singapore', 'Sri Lanka', 'Syria',
    'Taiwan', 'Tajikistan', 'Thailand', 'Turkey', 'United Arab Emirates', 'Uzbekistan', 'Vietnam', 'Yemen, Republic',
  ],
  Europe: [
    'Albania', 'Andorra (Principality of)', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria',
    'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece',
    'Guernsey (States of)', 'Hungary', 'Iceland', 'Ireland', 'Isle of Man', 'Italy', 'Jersey (States of)', 'Latvia',
    'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macedonia', 'Malta', 'Moldova', 'Montenegro', 'Netherlands', 'Norway',
    'Poland', 'Portugal', 'Romania', 'Russia', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland',
    'Ukraine', 'United Kingdom',
  ],
  'North America': [
    'Aruba', 'Bahamas', 'Barbados', 'Belize', 'Bermuda', 'Canada', 'Cayman Islands', 'Costa Rica', 'Cuba', 'Curacao',
    'Dominican Republic', 'El Salvador', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica', 'Mexico', 'Montserrat', 'Nicaragua',
    'Panama', 'St. Maarten', 'St. Vincent & the Grenadines', 'Trinidad and Tobago', 'Turks and Caicos Islands',
    'United States',
  ],
  'South America': [
    'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay',
    'Venezuela',
  ],
  Oceania: ['Australia', 'Cook Islands', 'Fiji', 'New Zealand', 'Papua New Guinea', 'Solomon Islands'],
};

// Damodaran's labels that differ from the names Yahoo Finance uses in company profiles.
const COUNTRY_ALIASES = { Korea: 'South Korea', 'Korea, D.P.R.': 'North Korea' };

const continentByCountry = new Map(
  Object.entries(CONTINENTS).flatMap(([continent, countries]) => countries.map((country) => [country, continent])),
);

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function parsePercent(text) {
  const value = Number.parseFloat(text.replace('%', ''));
  return Number.isFinite(value) ? value : null;
}

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Damodaran respondió HTTP ${response.status}`);
const html = new TextDecoder('latin1').decode(await response.arrayBuffer());

const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
  [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((cell) => decodeEntities(cell[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()));
const headerIndex = rows.findIndex((row) => row[0] === 'Country');
if (headerIndex < 0) throw new Error('No se encontró la tabla de países en la página de Damodaran.');

const countries = rows.slice(headerIndex + 1).flatMap((row) => {
  const [rawName, rating, defaultSpread, countryRiskPremium, equityRiskPremium, corporateTaxRate] = row;
  if (!rawName || parsePercent(countryRiskPremium ?? '') === null) return [];
  const name = rawName.replace(/\s*\(updated[^)]*\)/i, '').trim();
  const country = COUNTRY_ALIASES[name] ?? name;
  const continent = continentByCountry.get(country);
  if (!continent) throw new Error(`Falta el continente para ${country}; agrégalo a CONTINENTS.`);
  return [{
    country,
    continent,
    moodysRating: rating || null,
    defaultSpread: parsePercent(defaultSpread ?? ''),
    countryRiskPremium: parsePercent(countryRiskPremium),
    totalEquityRiskPremium: parsePercent(equityRiskPremium ?? ''),
    corporateTaxRate: parsePercent(corporateTaxRate ?? ''),
  }];
});

const updatedMatch = html.match(/updated:?\s*([A-Z][a-z]+ \d{1,2}, \d{4})/);
const output = {
  source: SOURCE_URL,
  sourceUpdatedAt: updatedMatch ? new Date(`${updatedMatch[1]} UTC`).toISOString().slice(0, 10) : null,
  generatedAt: new Date().toISOString().slice(0, 10),
  countries,
};
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Guardados ${countries.length} países (fuente actualizada ${output.sourceUpdatedAt ?? 'sin fecha'}).`);
