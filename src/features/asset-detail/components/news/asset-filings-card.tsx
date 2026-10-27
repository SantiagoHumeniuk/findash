// src/features/asset-detail/components/news/asset-filings-card.tsx

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { fetchSecFilings } from '../../../../services/api/yahoo-finance-api';

interface AssetFilingsCardProps {
  symbol: string;
}

const FORM_LABELS: Record<string, string> = {
  '8-K': 'Hecho relevante',
  '10-K': 'Informe anual',
  '10-Q': 'Informe trimestral',
};

/** 8-K item 2.02 is the earnings release, the closest equivalent to a press release. */
function describeFiling(form: string, items: string): string {
  if (form === '8-K' && items.split(',').includes('2.02')) return 'Resultados (comunicado)';
  return FORM_LABELS[form] ?? form;
}

/**
 * Official SEC filings for US issuers, replacing FMP's press-release feed.
 * Renders nothing for issuers without SEC filings or when the proxy has no SEC access.
 */
export function AssetFilingsCard({ symbol }: AssetFilingsCardProps) {
  const { data: filings = [] } = useQuery({
    queryKey: ['sec-filings', symbol],
    queryFn: () => fetchSecFilings(symbol, 8),
    enabled: !!symbol && symbol !== 'UNKNOWN' && !symbol.includes('.'),
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  if (filings.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" />
          Comunicados oficiales (SEC)
        </CardTitle>
        <CardDescription>
          Últimas presentaciones de {filings[0].companyName} ante la SEC de EE. UU.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y divide-border">
          {filings.map((filing) => (
            <li key={filing.url} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{describeFiling(filing.form, filing.items)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(`${filing.filingDate}T00:00:00`).toLocaleDateString('es-AR')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{filing.form}</Badge>
                <a
                  href={filing.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir ${filing.form} del ${filing.filingDate} en la SEC`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
