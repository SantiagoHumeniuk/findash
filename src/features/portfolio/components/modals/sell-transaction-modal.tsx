// src/features/portfolio/components/modals/sell-transaction-modal.tsx

import { useState, useEffect, useMemo } from 'react';
import { usePortfolio } from '../../../../hooks/use-portfolio';
import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { toast } from "sonner";
import { useTransactionForm } from '../../../../hooks/use-transaction-form';
import { SellTransactionModalProps } from '../../../../types/portfolio';
import { calculateFinalQuantity, calculateFinalPrice } from '../../lib/portfolio.utils';

import { Calendar } from "../../../../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "../../../../lib/utils";

/**
 * Modal para registrar una transacción de venta de un activo existente en el portafolio.
 */
export function SellTransactionModal({ isOpen, onClose, holding }: SellTransactionModalProps) {
  const { addTransaction, portfolios, transactions, currentPortfolio } = usePortfolio();
  const [loading, setLoading] = useState(false);

  // ✅ Reutilizamos el hook para manejar el estado del formulario
  const {
    quantity, setQuantity,
    price, setPrice,
    date, setDate,
    handleTypeChange,
    ratio, isCedears,
    cclRate,
    portfolioId, setPortfolioId
  } = useTransactionForm({
    isOpen,
    ticker: holding?.symbol ?? null,
    currentPrice: holding?.currentPrice ?? null
  });

  // Efecto para pre-seleccionar el portfolio actual si existe
  useEffect(() => {
    if (isOpen && currentPortfolio) {
      setPortfolioId(currentPortfolio.id);
    } else if (isOpen && portfolios.length > 0 && !portfolioId) {
      // Si estamos en "Todos", pre-seleccionar el primero que tenga este activo?
      // Por simplicidad, seleccionamos el primero si no hay uno seleccionado.
      // Mejor lógica: Buscar en qué portfolios existe este activo.
      const candidate = transactions.find(t => t.symbol === holding?.symbol && (t.transaction_type === 'buy' || t.transaction_type === 'sell'));
      if (candidate) {
        setPortfolioId(candidate.portfolio_id);
      } else {
        setPortfolioId(portfolios[0]?.id);
      }
    }
  }, [isOpen, currentPortfolio, portfolios, transactions, holding, portfolioId, setPortfolioId]);

  // Calcular la cantidad disponible EN EL PORTFOLIO SELECCIONADO
  const availableShares = useMemo(() => {
    if (!holding || !portfolioId) return 0;
    const relevantTransactions = transactions.filter(t => t.symbol === holding.symbol && t.portfolio_id === portfolioId);

    let shares = 0;
    for (const t of relevantTransactions) {
      if (t.transaction_type === 'buy') shares += t.quantity;
      if (t.transaction_type === 'sell') shares -= t.quantity;
    }
    return Math.max(0, shares); // Evitar negativos por error de datos
  }, [holding, portfolioId, transactions]);

  const maxCedears = ratio ? availableShares * ratio : 0;

  // Autocompletar cantidad máxima cuando se abre el modal
  useEffect(() => {
    if (isOpen && holding) {
      const maxQuantity = isCedears ? maxCedears : availableShares;
      setQuantity(maxQuantity.toString());
    }
  }, [isOpen, holding, isCedears, availableShares, maxCedears, setQuantity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holding) return;
    if (!portfolioId) {
      toast.error("Selecciona un portafolio de origen.");
      return;
    }

    const dateString = format(date, 'yyyy-MM-dd');

    setLoading(true);
    try {
      const enteredQuantity = parseFloat(quantity);
      const enteredPrice = parseFloat(price);

      // ✅ Validación: Cantidad debe ser un número válido y positivo
      if (isNaN(enteredQuantity) || enteredQuantity <= 0) {
        toast.error("Cantidad inválida", {
          description: "La cantidad debe ser un número positivo mayor a 0.",
        });
        setLoading(false);
        return;
      }

      // ✅ Validación: Precio debe ser un número válido y positivo
      if (isNaN(enteredPrice) || enteredPrice <= 0) {
        toast.error("Precio inválido", {
          description: "El precio de venta debe ser un número positivo mayor a 0.",
        });
        setLoading(false);
        return;
      }

      if (isCedears && !cclRate) {
        toast.error('No se pudo obtener el dólar CCL', {
          description: 'Espera a que se actualice la cotización para registrar la venta de CEDEARs.',
        });
        setLoading(false);
        return;
      }

      const finalQuantityInShares = calculateFinalQuantity(enteredQuantity, isCedears, ratio);

      // ✅ Validación: No puede vender más de lo que posee en ese portfolio
      if (finalQuantityInShares > availableShares + 1e-9) {
        const maxAvailableDisplay = isCedears ? maxCedears.toFixed(2) : availableShares.toFixed(4);
        const unit = isCedears ? 'CEDEARs' : 'acciones';
        toast.error("Cantidad excede lo disponible en este portafolio", {
          description: `Solo puedes vender hasta ${maxAvailableDisplay} ${unit} en el portafolio seleccionado.`,
        });
        setLoading(false);
        return;
      }

      // ✅ Validación: Precio no puede ser extremadamente grande
      if (enteredPrice > 1000000) {
        toast.error("Precio muy alto", {
          description: "El precio de venta no puede exceder $1,000,000 por unidad.",
        });
        setLoading(false);
        return;
      }

      const finalPricePerShare = calculateFinalPrice(enteredPrice, isCedears, ratio) / (isCedears ? cclRate! : 1);

      await addTransaction({
        symbol: holding.symbol,
        quantity: finalQuantityInShares,
        purchase_price: finalPricePerShare,
        purchase_date: dateString,
        transaction_type: 'sell',
        portfolio_id: portfolioId, // AHORA SÍ INCLUIDO
      });
      toast.success(`Venta de ${holding.symbol} registrada.`);
      onClose();
    } catch (error: unknown) {
      let message = 'Error desconocido';
      if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
        message = (error as { message: string }).message;
      }
      toast.error('No se pudo registrar la venta.', { description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vender <span className="text-primary">{holding?.symbol}</span></DialogTitle>
          <DialogDescription>
            {portfolioId ? (
              <>Disponible: {availableShares.toFixed(4)} acciones {ratio ? `(~${maxCedears.toFixed(2)} CEDEARs)` : ''}</>
            ) : "Selecciona un portafolio para ver disponibilidad"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); void handleSubmit(e); }} className="space-y-4 pt-4">

          {/* Portfolio Selector */}
          <div className="space-y-2">
            <Label htmlFor="portfolio-sell">Portafolio Origen</Label>
            <Select
              value={portfolioId?.toString()}
              onValueChange={(val) => setPortfolioId(parseInt(val))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un portafolio" />
              </SelectTrigger>
              <SelectContent>
                {portfolios.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {ratio && (
            <div>
              <Label className="mb-2 block">Vender como</Label>
              <div className="flex gap-2">
                <Button type="button" onClick={() => handleTypeChange('cedears')} variant={isCedears ? 'default' : 'outline'} className="flex-1">CEDEARs</Button>
                <Button type="button" onClick={() => handleTypeChange('shares')} variant={!isCedears ? 'default' : 'outline'} className="flex-1">Acciones</Button>
              </div>
              {isCedears && cclRate && (
                <p className="mt-2 text-xs text-muted-foreground">
                  CCL venta: ${cclRate.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ARS/USD.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity-sell">Cantidad a Vender</Label>
              <Input
                id="quantity-sell"
                type="number"
                step="any"
                min="0.0001"
                max={isCedears ? maxCedears : availableShares}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Máximo: {isCedears ? maxCedears.toFixed(2) : availableShares.toFixed(4)} {isCedears ? 'CEDEARs' : 'acciones'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price-sell">{isCedears ? 'Precio por CEDEAR (ARS)' : 'Precio por Acción (USD)'}</Label>
              <Input
                id="price-sell"
                type="number"
                step="any"
                min="0.01"
                max="1000000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fecha de Venta</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[270px] p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  initialFocus
                  locale={es}
                  className='w-[270px]'
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading} variant="destructive">{loading ? "Registrando..." : "Confirmar Venta"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}