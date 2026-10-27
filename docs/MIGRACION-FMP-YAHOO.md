# Migración de FMP a fuentes gratuitas (renta variable)

**Rama:** `experiment/yahoo-finance-local` (commits locales, sin push).
**Fecha:** 27 de octubre de 2026.
**Estado:** código completo y verificado localmente; falta desplegar el proxy y probar la app contra Supabase real.

## Resultado

FinDash ya no necesita una API paga para renta variable. De los 33 endpoints de FMP configurados en
`public/config.json`, 30 tienen reemplazo: 20 con datos de Yahoo Finance, 8 calculados por FinDash
a partir de esos datos y 2 con otras fuentes públicas (SEC EDGAR y Damodaran). Los 3 restantes
(segmentación por producto y por geografía, y artículos propios de FMP) quedan retirados.

| FMP | Reemplazo | Fuente |
|---|---|---|
| `profile`, `quote`, `historical`, `key-metrics-ttm` | Cotización, perfil (incluye CEO, dirección y teléfono), historial de 5 años, métricas TTM calculadas | Yahoo |
| `stock-price-change` | 1D a 5Y desde el historial (10Y no disponible: el historial cubre 5 años) | Calculado |
| `ratios`, `ratios-ttm`, `key-metrics` (anual) | ~55 ratios y ~40 métricas por año fiscal desde los estados financieros | Calculado con `fundamentals-timeseries` de Yahoo; SEC EDGAR si Yahoo trae menos de 2 años |
| `price-target-summary`, `price-target-consensus` | Objetivos por firma (30/90/365 días) y consenso alto/bajo/medio/mediana | Yahoo `upgradeDowngradeHistory` y `financialData` |
| `grades`, `grades-latest-news`, `price-target-latest-news` | Últimos 40 cambios de calificación por firma | Yahoo `upgradeDowngradeHistory` |
| `grades-consensus` | Conteos strong buy … strong sell y consenso | Yahoo `recommendationTrend` |
| `analyst-estimates` | Ingresos y EPS (promedio, mínimo, máximo, número de analistas) del año en curso y el siguiente | Yahoo `earningsTrend` (sin EBITDA, EBIT, ingreso neto ni SG&A estimados) |
| `stock-peers` | Hasta 5 comparables con P/E, P/B, P/S, EV/EBITDA, EV/Ventas, margen, ROE y D/E | Yahoo `recommendationsbysymbol` |
| `custom-discounted-cash-flow`, `levered-discounted-cash-flow` | DCF propio a 5 años (WACC con beta de Blume, tasa a 10 años `^TNX` y ERP de Damodaran) y DCF apalancado (FCFE) | Calculado |
| `ratings-snapshot` | Scorecard FinDash con los mismos seis factores (DCF, ROE, ROA, D/E, P/E, P/B) | Calculado |
| `market-risk-premium` | Prima de riesgo país y prima total por país (178 países) | Damodaran, tabla incluida en `src/data/` |
| `dividends-calendar` | Próximas fechas ex/pago, último dividendo, rendimiento y frecuencia de unas 150 acciones | Yahoo (`calendarEvents` + eventos del gráfico) |
| `available-sectors`, `available-industries`, `historical-sector/industry-performance` | 11 sectores y ~145 industrias con su índice propio (`^YH311`, `^YH31130020`…) | Yahoo |
| `news/stock`, `news/general-latest`, `news/forex`, `news/crypto` | Noticias por símbolo y por categoría | Yahoo |
| `news/press-releases` | Presentaciones 8-K/10-K/10-Q; los 8-K con ítem 2.02 se marcan como comunicados de resultados | SEC EDGAR (solo emisores de EE. UU.) |
| `biggest-gainers/losers`, `most-actives` | Screeners predefinidos | Yahoo |
| `revenue-product-segmentation`, `revenue-geographic-segmentation` | **Sin reemplazo.** EDGAR no expone segmentos en `companyfacts`; habría que leer el XBRL de cada 10-K | — |
| `fmp-articles` | **Sin reemplazo** (contenido propio de FMP) | — |

El calendario macroeconómico tampoco tiene una fuente gratuita equivalente. FRED publica fechas
de publicación con una API key gratuita, pero no trae consenso ni pronóstico.

## Diferencias que conviene conocer

- **Métodos propios.** El DCF, los ratios y el scorecard los calcula FinDash y no van a coincidir
  exactamente con los de FMP. Las tarjetas lo indican ("Calculado por FinDash con datos de …").
- **Historia.** Yahoo da 4 años fiscales (EDGAR, hasta 10 para EE. UU.); FMP daba más. Los
  múltiplos de mercado por año usan el precio de cierre de la semana del cierre fiscal.
- **Moneda.** Si los estados financieros están en otra moneda que la cotización (ADRs), no se
  calculan múltiplos de mercado ni DCF para no mezclar monedas. Cuando un emisor cambió de moneda
  de reporte (por ejemplo YPF, de ARS a USD), solo se usan los años en la moneda actual.
- **Ceros y faltantes.** Las métricas sin datos son `null` y se muestran como no disponibles.
  `AssetQuote` y `AssetProfile` siguen usando 0 para los campos de cotización ausentes.
- **Endpoints no oficiales.** Yahoo puede cambiar parámetros o limitar el tráfico. El proxy reintenta
  ante errores 429 y 5xx, reutiliza la sesión (crumb) y cachea en `asset_data_cache`; aun así no hay
  SLA. Revisar los términos de uso de Yahoo y de la SEC antes de un uso comercial.

## Despliegue (pendiente)

1. Definir el secreto para EDGAR (la SEC exige un User-Agent con contacto real):

   ```bash
   supabase secrets set SEC_USER_AGENT="FinDash <email de contacto>"
   ```

   Sin este secreto, el proxy funciona igual pero sin respaldo EDGAR ni comunicados SEC.
2. Desplegar el proxy: `supabase functions deploy yahoo-finance-proxy`. Usa `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY`, que Supabase inyecta automáticamente, para la caché compartida.
3. Publicar el frontend. Los activos cacheados con el formato anterior se reconstruyen solos
   (`YAHOO_DATA_VERSION = 2`) en el siguiente acceso, como máximo 15 minutos después del último
   intento.
4. Probar con usuarios reales: detalle de AAPL, KO, MELI, YPF, GGAL.BA y SPY (pestañas Fundamentales,
   Analistas y Noticias; tarjetas de valor justo y scorecard), dashboard con radar y resumen, sectores,
   dividendos, riesgo país y la barra superior.
5. Recién después, revisar en Supabase que nada invoque `fmp-proxy` (logs de Edge Functions de los
   últimos 30 días), borrar el secreto de FMP y la función, y cancelar el plan.

## Verificación realizada

- `tsc` sin errores, ESLint sin errores, `vite build` correcto.
- Vitest: 174 tests pasan. Fallan 5 de `use-watchlist.test.tsx`, que ya fallaban antes de la
  migración (al test le falta un `ConfigProvider`).
- `deno check` del proxy y `deno test calc.test.ts` (4 tests).
- Proxy ejecutado localmente contra Yahoo real: AAPL, KO, MELI, YPF, GGAL.BA y SPY (cotización,
  estados, analistas, comparables), sectores, índices `^YH`, dividendos de 50 símbolos, presentaciones
  SEC y la barra de 20 símbolos. Los datos se pasaron por el armado de `AssetData` y el motor de
  valuación, con resultados razonables.
- No se probó la app en el navegador contra Supabase: el repo no tiene migraciones del esquema y
  Supabase local requiere Docker.

## Actualizar datos de Damodaran

Damodaran actualiza la tabla en enero y en julio:

```bash
node scripts/update-damodaran-risk.mjs
```
