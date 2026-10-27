// src/features/asset-detail/components/header/asset-header.tsx

import type { AssetData } from '../../../../types/dashboard';
import { WatchlistToggleButton } from '../../../watchlist/components';

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
      <img
        src={profile.image}
        alt={profile.companyName}
        className="w-16 h-16 sm:w-20 sm:h-20 md:w-30 md:h-30 rounded-lg border object-contain bg-background shadow-sm"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.onerror = null;
          target.src = '/placeholder.svg';
        }}
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
          <WatchlistToggleButton symbol={profile.symbol} variant="outline" size="sm" />
        </div>
      </div>
    </div>
  );
}