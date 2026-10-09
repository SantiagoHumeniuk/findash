# Market data and portfolio report

## Yahoo Finance

The `yahoo-finance-proxy` Supabase Edge Function fetches Yahoo quote-summary fundamentals
using Yahoo's cookie/crumb session and uses Yahoo chart data as a quote/history fallback.
Yahoo fields supplement FMP values; the dashboard and portfolio analysis use only fields
that the upstream actually returned. Partial Yahoo responses are retained and surfaced
instead of being discarded because the fundamental endpoint failed.

Cached portfolio assets are eligible for a Yahoo refresh when Yahoo data is missing or
partial. This refresh is subject to the user's existing API allowance and is throttled to
one attempt per ticker every 15 minutes. Old portfolio cache entries are no longer kept
indefinitely.

The dashboard summary and portfolio advisory can use Yahoo's forward P/E, forward EPS,
growth, target mean, and analyst coverage when those fields are present. A price-target
signal is directional only with at least three analysts and a 20% upside/downside; smaller
coverage is shown as context without affecting the recommendation score.

## Fixed income

Live bid/ask and last prices come from DATA912. `fixed-income-sheet-proxy` reads the public
Google workbook's `Soberanos USD`, `ONs`, `Provinciales`, `Pesos Tasa Fija`, `CER`, `Fichas`,
and `Flujos` tabs server-side; the browser does not fetch Google Sheets directly. Contract
terms and future payment schedules are joined to current market quotes by the workbook's
market ticker.

For instruments with compatible live prices and future payments, annual effective yield
is solved from the remaining dated cash flows and the DATA912 bid/ask midpoint. A yield is
left blank when the price, payment currency, or cash-flow basis cannot be matched. TAMAR
payments are estimates, and CER-linked instruments are labeled as real yields. The source
sheet's precomputed yield and stale snapshot prices are not represented as current live
yields.

## Portfolio PDF

The portfolio export includes the metrics shown in the portfolio summary, all open
positions, historical portfolio value when available, asset allocation, per-asset
percentage returns, sector allocation, and geographic allocation. Charts and tables are
paginated. Mixed-currency totals are not converted and are labeled as non-comparable.

## Supabase deployment

Vercel deploys the web frontend; it does not deploy Supabase Edge Functions. After linking
the intended Supabase project, deploy the updated Yahoo proxy and the new fixed-income
workbook proxy:

```bash
supabase functions deploy yahoo-finance-proxy
supabase functions deploy fixed-income-sheet-proxy
```

The Google workbook must remain publicly readable for the fixed-income proxy to fetch it.
The sheet ID is configured in the Edge Function source; do not place service-role or
Yahoo credentials in browser code.
