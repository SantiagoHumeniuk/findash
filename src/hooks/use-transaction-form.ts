// src/hooks/useTransactionForm.ts

import { useState, useEffect, useCallback } from 'react';
import { useCedearRatios } from './use-cedear-ratios';
import { useCclRate } from './use-ccl-rate';
import { usePortfolio } from './use-portfolio'; // Importamos usePortfolio

type InputType = 'shares' | 'cedears';

interface UseTransactionFormProps {
  isOpen: boolean;
  ticker: string | null;
  currentPrice: number | null;
}

/**
 * Hook para gestionar el estado y la lógica de los formularios de transacciones (compra/venta).
 * Encapsula el manejo de cantidad, precio, fecha y la conversión entre Acciones y CEDEARs.
 */
export const useTransactionForm = ({ isOpen, ticker, currentPrice }: UseTransactionFormProps) => {
  const { currentPortfolio } = usePortfolio(); // Obtenemos el portfolio actual
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [inputType, setInputType] = useState<InputType>('shares');
  const [portfolioId, setPortfolioId] = useState<number | null>(null); // Estado para el portfolio seleccionado

  const { ratios: cedearRatios } = useCedearRatios();
  const { data: cclQuote, isLoading: loadingCcl } = useCclRate();

  // Intentamos obtener el ratio usando el ticker tal cual (ej: 'MELI')
  // Si no lo encontramos, intentamos normalizándolo (quitando caracteres no alfanuméricos, ej: 'BRK-B' -> 'BRKB')
  const ratio = ticker
    ? (cedearRatios[ticker] || cedearRatios[ticker.replace(/[^a-zA-Z]/g, '')])
    : undefined;

  // Resetea y establece los valores iniciales del formulario cuando el modal se abre.
  useEffect(() => {
    if (isOpen && ticker) {
      if (ratio && currentPrice) {
        setPrice('');
        setInputType('cedears');
      } else if (currentPrice) {
        setPrice(currentPrice.toFixed(2));
        setInputType('shares');
      } else {
        setPrice('');
      }
      setQuantity('');
      setDate(new Date());
      // Inicializar con el portfolio actual si existe
      if (currentPortfolio) {
        setPortfolioId(currentPortfolio.id);
      }
    }
  }, [isOpen, currentPrice, ratio, ticker, currentPortfolio]);

  useEffect(() => {
    if (isOpen && ratio && currentPrice && cclQuote?.rate && !price) {
      setPrice(((currentPrice * cclQuote.rate) / ratio).toFixed(2));
    }
  }, [isOpen, currentPrice, ratio, cclQuote?.rate, price]);

  // Maneja el cambio entre input de 'shares' y 'cedears', convirtiendo los valores.
  const handleTypeChange = useCallback((newType: InputType) => {
    if (newType === inputType || !ratio) return;
    if (!cclQuote?.rate) return;

    const numQuantity = parseFloat(quantity);
    const numPrice = parseFloat(price);

    // Convertir cantidad solo si existe
    if (!isNaN(numQuantity) && numQuantity > 0) {
      if (newType === 'cedears') {
        setQuantity((numQuantity * ratio).toFixed(2));
      } else { // 'shares'
        setQuantity((numQuantity / ratio).toFixed(4));
      }
    }

    // Convertir precio siempre (incluso sin cantidad)
    if (!isNaN(numPrice) && numPrice > 0) {
      if (newType === 'cedears') {
        setPrice(((numPrice * cclQuote.rate) / ratio).toFixed(2));
      } else { // 'shares'
        setPrice(((numPrice * ratio) / cclQuote.rate).toFixed(4));
      }
    }

    setInputType(newType);
  }, [inputType, quantity, price, ratio, cclQuote?.rate]);

  const isCedears = inputType === 'cedears';

  return {
    quantity, setQuantity,
    price, setPrice,
    date, setDate,
    inputType, handleTypeChange,
    ratio, isCedears,
    cclRate: cclQuote?.rate ?? null,
    loadingCcl,
    portfolioId, setPortfolioId, // Exponemos el estado del portfolio
  };
};