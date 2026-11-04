// src/features/portfolio/components/modals/buy-asset-dialog.tsx

import { useState } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { fetchYahooMarketQuotes } from '../../../../services/api/yahoo-finance-api';
import { TickerAddForm } from '../../../dashboard/components/ticker-input/ticker-add-form';

interface BuyAssetDialogProps {
  /** Opens the purchase form for the chosen symbol at its current price (null when unavailable). */
  onChoose: (symbol: string, price: number | null) => void;
}

/** Lets the user pick any asset to buy from the portfolio itself. */
export function BuyAssetDialog({ onChoose }: BuyAssetDialogProps) {
  const [open, setOpen] = useState(false);
  const [loadingSymbol, setLoadingSymbol] = useState<string | null>(null);

  const choose = async (symbol: string) => {
    setLoadingSymbol(symbol);
    let price: number | null = null;
    try {
      const { quotes } = await fetchYahooMarketQuotes([symbol]);
      const value = quotes.find((quote) => quote.symbol === symbol)?.price.value ?? null;
      price = value !== null && Number.isFinite(value) && value > 0 ? value : null;
      if (price === null) toast.info(`No encontramos el precio actual de ${symbol}; cargalo a mano.`);
    } catch {
      toast.info(`No pudimos traer el precio de ${symbol}; cargalo a mano.`);
    } finally {
      setLoadingSymbol(null);
    }
    setOpen(false);
    onChoose(symbol, price);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <ShoppingCart className="h-4 w-4" />
        Comprar activo
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Comprar activo</DialogTitle>
            <DialogDescription>Buscá el activo por ticker o por nombre y registrá la compra.</DialogDescription>
          </DialogHeader>
          {loadingSymbol ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando el precio de {loadingSymbol}…
            </p>
          ) : (
            <TickerAddForm onAddTicker={(symbol) => void choose(symbol)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
