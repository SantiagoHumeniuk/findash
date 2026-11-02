// src/features/alerts/components/create-alert-dialog.tsx

import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { type AlertCondition, useAlertMutations } from '../hooks/use-alerts';

interface CreateAlertDialogProps {
  /** Fixed symbol when opened from an asset; empty lets the user type one. */
  symbol?: string;
  currentPrice?: number;
  currency?: string;
  trigger: ReactNode;
}

const CONDITION_LABELS: Record<AlertCondition, string> = {
  above: 'El precio sube a',
  below: 'El precio baja a',
  move: 'Se mueve en el día al menos (%)',
};

export function CreateAlertDialog({ symbol, currentPrice, currency = 'USD', trigger }: CreateAlertDialogProps) {
  const [open, setOpen] = useState(false);
  const [symbolInput, setSymbolInput] = useState('');
  const [condition, setCondition] = useState<AlertCondition>('above');
  const [target, setTarget] = useState('');
  const { createAlert, isAtLimit, limitMessage } = useAlertMutations();

  const finalSymbol = (symbol ?? symbolInput).trim().toUpperCase();
  const targetValue = Number(target.replace(',', '.'));
  const isValid = /^[A-Z0-9.^=-]{1,15}$/.test(finalSymbol) && Number.isFinite(targetValue) && targetValue > 0;
  const alreadyMet = currentPrice !== undefined && isValid && (
    (condition === 'above' && currentPrice >= targetValue) ||
    (condition === 'below' && currentPrice <= targetValue)
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    createAlert.mutate({ symbol: finalSymbol, condition, target: targetValue }, {
      onSuccess: () => {
        setOpen(false);
        setTarget('');
        setSymbolInput('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{symbol ? `Nueva alerta para ${symbol}` : 'Nueva alerta'}</DialogTitle>
          <DialogDescription>
            Te avisamos cuando se cumpla. Revisamos los precios cada 10 minutos, de lunes a viernes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!symbol && (
            <div className="space-y-1.5">
              <Label htmlFor="alert-symbol">Símbolo</Label>
              <Input
                id="alert-symbol"
                value={symbolInput}
                onChange={(event) => setSymbolInput(event.target.value)}
                placeholder="AAPL, GGAL.BA, MELI…"
                autoComplete="off"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="alert-condition">Avisarme cuando</Label>
            <Select value={condition} onValueChange={(value) => setCondition(value as AlertCondition)}>
              <SelectTrigger id="alert-condition"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CONDITION_LABELS) as AlertCondition[]).map((key) => (
                  <SelectItem key={key} value={key}>{CONDITION_LABELS[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alert-target">{condition === 'move' ? 'Porcentaje' : `Precio (${currency})`}</Label>
            <Input
              id="alert-target"
              inputMode="decimal"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder={condition === 'move' ? '3' : currentPrice?.toFixed(2)}
            />
            {currentPrice !== undefined && (
              <p className="text-xs text-muted-foreground">Precio actual: {currency} {currentPrice.toFixed(2)}</p>
            )}
            {alreadyMet && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Esta condición ya se cumple: se va a activar en la próxima revisión.</p>
            )}
          </div>
          {isAtLimit && <p role="alert" className="text-sm text-destructive">{limitMessage}</p>}
          <Button type="submit" className="w-full" disabled={!isValid || isAtLimit || createAlert.isPending}>
            {createAlert.isPending ? 'Creando…' : 'Crear alerta'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
