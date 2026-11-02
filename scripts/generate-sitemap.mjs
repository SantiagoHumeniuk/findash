// Regenerates public/sitemap.xml with the public pages and every asset already
// saved in asset_data_cache (visitors without an account can only open those).
// Run: node --env-file=.env scripts/generate-sitemap.mjs

import { writeFileSync } from 'node:fs';

const SITE = process.env.SITE_URL ?? 'https://findash-data.vercel.app';
const PAGES = ['/', '/plans', '/screener', '/cedears', '/economic-calendar', '/risk-premium', '/sectors-industries'];
const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = process.env;
if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');

const response = await fetch(
  `${url}/rest/v1/asset_data_cache?select=symbol&data->>dataSource=eq.Yahoo%20Finance&order=symbol`,
  { headers: { apikey: key } },
);
if (!response.ok) throw new Error(`Supabase respondió HTTP ${response.status}`);
const symbols = (await response.json())
  .map((row) => row.symbol)
  .filter((symbol) => /^[A-Z0-9.-]{1,15}$/.test(symbol));

const urls = [...PAGES, ...symbols.map((symbol) => `/asset/${symbol}`)];
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${SITE}${path}</loc></url>`).join('\n')}
</urlset>
`;
writeFileSync(new URL('../public/sitemap.xml', import.meta.url), xml);
console.log(`sitemap.xml: ${urls.length} URLs (${symbols.length} activos).`);
