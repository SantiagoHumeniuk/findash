import { Map } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { usePageMeta } from '../../../hooks/use-page-meta';
import { MarketHeatmap } from '../components/market-heatmap';

/** Sector-based market map with drill-down to leading companies. */
export default function MarketMapPage() {
  usePageMeta('Mapa del mercado', 'Explorá el comportamiento del mercado por sectores y sus principales empresas.');

  return (
    <div className="container-wide stack-6">
      <PageHeader
        icon={<Map className="w-8 h-8 text-primary" />}
        title="Mapa del mercado"
        description="Explorá el mercado por sectores y acercate a sus principales empresas."
      />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mercado de EE. UU.</CardTitle>
          <CardDescription>
            Cada bloque representa un sector. Elegí uno para explorar sus principales empresas.
          </CardDescription>
        </CardHeader>
        <CardContent><MarketHeatmap /></CardContent>
      </Card>
    </div>
  );
}
