// src/utils/portfolio-calculations.ts

import { Transaction, Holding } from '../types/portfolio';
import { AssetData } from '../types/dashboard';

/**
 * Calcula las posiciones actuales (holdings) a partir de un historial de transacciones.
 * @param transactions - Array de todas las transacciones del usuario.
 * @param portfolioData - Objeto con los datos de mercado actuales de los activos.
 * @returns Un array de Holdings consolidados.
 */
export function calculateHoldings(
  transactions: Transaction[],
  portfolioData: Record<string, AssetData>
): Holding[] {
  const assetMap = new Map<string, { quantity: number; totalCost: number; symbol: string }>();

  // Ordenar transacciones cronológicamente para un cálculo correcto del costo.
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime()
  );

  for (const tx of sortedTransactions) {
    const asset = assetMap.get(tx.symbol) ?? { quantity: 0, totalCost: 0, symbol: tx.symbol };

    if (tx.transaction_type === 'buy') {
      asset.quantity += Number(tx.quantity);
      asset.totalCost += Number(tx.quantity) * Number(tx.purchase_price);
    } else { // 'sell'
      // Al vender, se reduce el costo promedio de forma proporcional.
      const proportionSold = asset.quantity > 0 ? Number(tx.quantity) / asset.quantity : 0;
      asset.totalCost -= asset.totalCost * proportionSold;
      asset.quantity -= Number(tx.quantity);
    }
    assetMap.set(tx.symbol, asset);
  }

  const holdingsArray: Holding[] = [];
  assetMap.forEach((asset, symbol) => {
    // Solo incluir activos con una cantidad positiva (evita errores de punto flotante)
    if (asset.quantity > 1e-9) {
      const assetData = portfolioData[symbol] || {
        profile: { symbol, price: 0, marketCap: 0, beta: 0 } as AssetData['profile'],
        quote: { symbol, name: symbol, price: 0, change: 0, changePercentage: 0 } as AssetData['quote'],
      } as AssetData;
      
      holdingsArray.push({
        ...asset,
        avgPurchasePrice: asset.quantity > 0 ? asset.totalCost / asset.quantity : 0,
        assetData,
      });
    }
  });

  return holdingsArray;
}

/**
 * Calcula el rendimiento total del portafolio, incluyendo posiciones cerradas.
 * @param transactions - Array de todas las transacciones del usuario.
 * @param holdings - Array de las posiciones actuales ya calculadas.
 * @returns Un objeto con la ganancia/pérdida total en monto y porcentaje.
 */
export function calculateTotalPerformance(
  transactions: Transaction[],
  holdings: Holding[]
) {
  let cash = 0;
  let contributedCapital = 0;
  const sortedTransactions = [...transactions].sort((a, b) =>
    new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime() || a.id - b.id
  );

  for (const tx of sortedTransactions) {
    const tradeValue = Number(tx.quantity) * Number(tx.purchase_price);
    if (tx.transaction_type === 'buy') {
      const externalFunding = Math.max(0, tradeValue - cash);
      contributedCapital += externalFunding;
      cash = Math.max(0, cash - tradeValue);
    } else {
      cash += tradeValue;
    }
  }

  const currentValue = holdings.reduce((sum, h) => {
    const currentPrice = h.assetData?.quote?.price ?? 0;
    return sum + (h.quantity * currentPrice);
  }, 0);

  const totalPL = currentValue + cash - contributedCapital;
  const totalPLPercent = contributedCapital > 0 ? (totalPL / contributedCapital) * 100 : 0;

  return {
    pl: totalPL,
    percent: totalPLPercent,
  };
}