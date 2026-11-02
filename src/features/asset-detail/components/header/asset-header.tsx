// src/features/asset-detail/components/header/asset-header.tsx

import type { AssetData } from '../../../../types/dashboard';
import { WatchlistToggleButton } from '../../../watchlist/components';
import { AssetLogo } from '../../../../components/ui/asset-logo';
import { Bell } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { CreateAlertDialog } from '../../../alerts/components/create-alert-dialog';

/**
 * Props para el componente AssetHeader.
 * @property asset - Datos del activo con la nueva estructura (profile, quote, etc.)
 */
interface AssetHeaderProps {
  asset: AssetData;
}

/**
 * Componente que muestra el encabezado del detalle del activo.
 * Incluye logo, nombre, símbolo, bolsa, precio actual y cambio del día.
 */
export function AssetHeader({ asset }: AssetHeaderProps) {
  const { profile } = asset;

  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
      <AssetLogo
        morph
        symbol={profile.symbol}
        name={profile.companyName}
        src={profile.image}
        className="size-16 sm:size-20 md:size-24 rounded-xl p-2 text-xl shadow-sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 sm:gap-4 mb-1.5 sm:mb-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold truncate">
              {profile.companyName} ({profile.symbol})
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground">
              {profile.exchangeFullName}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <CreateAlertDialog
              symbol={profile.symbol}
              currentPrice={asset.quote.price > 0 ? asset.quote.price : undefined}
              currency={profile.currency || 'USD'}
              trigger={<Button variant="outline" size="sm" className="gap-1.5"><Bell className="h-4 w-4" />Alerta</Button>}
            />
            <WatchlistToggleButton symbol={profile.symbol} variant="outline" size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}