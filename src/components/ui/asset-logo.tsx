// src/components/ui/asset-logo.tsx

import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { useAssetLogos } from '../../hooks/use-asset-logos';

interface AssetLogoProps {
  symbol: string;
  name?: string;
  /** Known logo URL. When empty, the logo is looked up by symbol (cached for a day). */
  src?: string | null;
  className?: string;
  /** Set to false when the caller already resolves logos in a batch. */
  lookup?: boolean;
}

/**
 * Company logo with a two-letter ticker badge when no logo exists or it fails to load.
 * Size it with `className` (for example `size-8`).
 */
export function AssetLogo({ symbol, name, src, className, lookup = true }: AssetLogoProps) {
  const lookedUp = useAssetLogos(src || !lookup ? [] : [symbol]);
  const url = src || lookedUp[symbol.toUpperCase()] || null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={`Logo de ${name ?? symbol}`}
        loading="lazy"
        className={cn('size-8 shrink-0 rounded-full border bg-white object-contain p-0.5', className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={`${name ?? symbol} (sin logo)`}
      title={name ?? symbol}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full border bg-primary/10 text-[0.65rem] font-bold text-primary',
        className,
      )}
    >
      {symbol.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()}
    </span>
  );
}
