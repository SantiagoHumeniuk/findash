import React from 'react';
import { AlertCircle, Clock3, FlaskConical, RefreshCw } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchYahooFinanceQuotes } from '@/services/api/yahoo-finance-api';
import type { YahooFinanceMetric, YahooFinanceQuote } from '@/services/api/yahoo-finance-api';
import { hasApiCallsAvailable, incrementApiCallCounter } from '@/services/api/apiLimiter';
import { useAuth } from '@/hooks/use-auth';
import { useConfig } from '@/hooks/use-config';

const defaultSymbols = 'AAPL, MSFT, NVDA, GOOGL';

function formatMetric(metric: YahooFinanceMetric, digits = 2): string {
  return metric.value === null
    ? 'No disponible'
    : new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(metric.value);
}

function formatTimestamp(timestamp: number | null): string {
  if (timestamp === null) return 'Sin dato de mercado';
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return 'Fecha inválida';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZoneName: 'short',
  }).format(date);
}

function formatAge(timestamp: number | null): string {
  if (timestamp === null) return 'Antigüedad desconocida';
  const ageInMinutes = Math.max(0, Math.floor((Date.now() - timestamp * 1000) / 60_000));
  if (ageInMinutes < 1) return 'hace menos de 1 min';
  if (ageInMinutes < 60) return `hace ${ageInMinutes} min`;
  const ageInHours = Math.floor(ageInMinutes / 60);
  if (ageInHours < 24) return `hace ${ageInHours} h`;
  return `hace ${Math.floor(ageInHours / 24)} d`;
}

function formatMarketCap(metric: YahooFinanceMetric, currency: string | null): string {
  if (metric.value === null) return 'No disponible';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency ?? 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(metric.value);
}

function formatPrice(metric: YahooFinanceMetric, currency: string | null): string {
  if (metric.value === null) return 'No disponible';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency ?? 'USD',
    maximumFractionDigits: 2,
  }).format(metric.value);
}

function QuoteCard({ quote }: { quote: YahooFinanceQuote }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">
            {quote.symbol} {quote.name ? `· ${quote.name}` : ''}
          </CardTitle>
          {quote.marketState && <Badge variant="secondary">{quote.marketState}</Badge>}
        </div>
        {quote.error ? (
          <CardDescription className="text-destructive">{quote.error}</CardDescription>
        ) : (
          <CardDescription>
            {quote.exchange ?? 'Bolsa no informada'}
            {quote.delayedByMinutes !== null
              ? ` · demora declarada: ${quote.delayedByMinutes} min`
              : ''}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Metric label="Precio" value={formatPrice(quote.price, quote.currency)} />
          <Metric label="PER (trailing)" value={formatMetric(quote.trailingPE)} />
          <Metric label="PER forward" value={formatMetric(quote.forwardPE)} />
          <Metric label="EPS trailing" value={formatMetric(quote.trailingEPS)} />
          <Metric label="EPS forward" value={formatMetric(quote.forwardEPS)} />
          <Metric label="Capitalización" value={formatMarketCap(quote.marketCap, quote.currency)} />
        </div>
        <div className="border-t pt-3 text-sm">
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p>{formatTimestamp(quote.marketTimestamp)}</p>
              <p className="text-muted-foreground">{formatAge(quote.marketTimestamp)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

/**
 * Temporary Yahoo Finance experiment for comparing quote freshness and valuation fields.
 *
 * @remarks
 * This panel displays individual sample tickers; it does not calculate sector-level ratios.
 */
export function YahooFinanceTest() {
  const [symbolsInput, setSymbolsInput] = React.useState(defaultSymbols);
  const { user, profile } = useAuth();
  const config = useConfig();
  const query = useMutation({
    mutationFn: async (symbols: string[]) => {
      if (!user || !profile) {
        throw new Error('Inicia sesión para consultar Yahoo Finance.');
      }
      if (!await hasApiCallsAvailable(user, profile, config)) {
        throw new Error('Se alcanzó el límite diario de consultas del plan o no se pudo verificar el uso.');
      }
      const response = await fetchYahooFinanceQuotes(symbols);
      await incrementApiCallCounter(user.id);
      return response;
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const symbols = [...new Set(
      symbolsInput.split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean),
    )];
    query.mutate(symbols);
  };

  return (
    <section className="space-y-6">
      <Card className="border-amber-500/40">
        <CardHeader>
          <div className="flex items-start gap-3">
            <FlaskConical className="mt-1 size-5 shrink-0 text-amber-600" />
            <div>
              <CardTitle>Sector temporal: Tecnología · Yahoo Finance</CardTitle>
              <CardDescription className="mt-1">
                Prueba exploratoria por símbolo; no representa un PER agregado del sector.
                Consulta PER trailing/forward, EPS forward y fecha de la cotización.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <Input
              aria-label="Símbolos de Yahoo Finance"
              value={symbolsInput}
              onChange={(event) => setSymbolsInput(event.target.value)}
              placeholder="AAPL, MSFT, NVDA, GOOGL"
              maxLength={120}
            />
            <Button type="submit" disabled={query.isPending || !symbolsInput.trim()}>
              <RefreshCw className={`mr-2 size-4 ${query.isPending ? 'animate-spin' : ''}`} />
              {query.isPending ? 'Consultando...' : 'Consultar Yahoo'}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Máximo 8 símbolos. Yahoo puede omitir métricas y aplicar demoras según el mercado.
          </p>
        </CardContent>
      </Card>

      {query.isError && (
        <div role="alert" className="flex gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">No se pudo consultar Yahoo Finance</p>
            <p className="mt-1 text-muted-foreground">{query.error.message}</p>
          </div>
        </div>
      )}

      {query.data && (
        <>
          <p className="text-sm text-muted-foreground">
            Consulta recibida: {new Intl.DateTimeFormat('es-AR', {
              dateStyle: 'medium',
              timeStyle: 'medium',
              timeZoneName: 'short',
            }).format(new Date(query.data.fetchedAt))}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {query.data.quotes.map((quote) => <QuoteCard key={quote.symbol} quote={quote} />)}
          </div>
        </>
      )}
    </section>
  );
}
