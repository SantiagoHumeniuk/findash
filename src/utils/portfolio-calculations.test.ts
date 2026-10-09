// src/utils/portfolio-calculations.test.ts

import { describe, it, expect } from 'vitest';
import { calculateHoldings, calculateTotalPerformance } from './portfolio-calculations';
import { Transaction } from '../types/portfolio';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PortfolioAssetData = any;

describe('portfolio-calculations', () => {
  describe('calculateHoldings', () => {
    it('should calculate holdings correctly for buy transactions', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 10,
          purchase_price: 150,
          purchase_date: '2024-01-01',
          transaction_type: 'buy',
        },
        {
          id: 2,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 5,
          purchase_price: 160,
          purchase_date: '2024-02-01',
          transaction_type: 'buy',
        },
      ];

      const portfolioData: Record<string, PortfolioAssetData> = {
        AAPL: {
          symbol: 'AAPL',
          quote: { price: 170, change: 0, changePercentage: 0 }
        },
      };

      const holdings = calculateHoldings(transactions, portfolioData);

      expect(holdings).toHaveLength(1);
      expect(holdings[0].symbol).toBe('AAPL');
      expect(holdings[0].quantity).toBe(15);
      // Average price: (10 * 150 + 5 * 160) / 15 = 2300 / 15 ≈ 153.33
      expect(holdings[0].avgPurchasePrice).toBeCloseTo(153.33, 2);
      expect(holdings[0].totalCost).toBe(2300);
      expect(holdings[0].assetData.quote?.price).toBe(170);
    });

    it('should calculate holdings correctly for buy and sell transactions', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'GOOGL',
          quantity: 20,
          purchase_price: 100,
          purchase_date: '2024-01-01',
          transaction_type: 'buy',
        },
        {
          id: 2,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'GOOGL',
          quantity: 10,
          purchase_price: 120,
          purchase_date: '2024-02-01',
          transaction_type: 'sell',
        },
      ];

      const portfolioData: Record<string, PortfolioAssetData> = {
        GOOGL: {
          symbol: 'GOOGL',
          quote: { price: 130, change: 0, changePercentage: 0 }
        },
      };

      const holdings = calculateHoldings(transactions, portfolioData);

      expect(holdings).toHaveLength(1);
      expect(holdings[0].symbol).toBe('GOOGL');
      expect(holdings[0].quantity).toBe(10);
      // After selling 50% (10 of 20), the totalCost should be 1000 (50% of 2000)
      expect(holdings[0].totalCost).toBe(1000);
      expect(holdings[0].avgPurchasePrice).toBe(100);
    });

    it('should exclude holdings with zero or negative quantity', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'TSLA',
          quantity: 10,
          purchase_price: 200,
          purchase_date: '2024-01-01',
          transaction_type: 'buy',
        },
        {
          id: 2,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'TSLA',
          quantity: 10,
          purchase_price: 250,
          purchase_date: '2024-02-01',
          transaction_type: 'sell',
        },
      ];

      const portfolioData: Record<string, PortfolioAssetData> = {};

      const holdings = calculateHoldings(transactions, portfolioData);

      expect(holdings).toHaveLength(0);
    });

    it('should handle multiple different assets', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 10,
          purchase_price: 150,
          purchase_date: '2024-01-01',
          transaction_type: 'buy',
        },
        {
          id: 2,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'GOOGL',
          quantity: 5,
          purchase_price: 100,
          purchase_date: '2024-01-02',
          transaction_type: 'buy',
        },
      ];

      const portfolioData: Record<string, PortfolioAssetData> = {
        AAPL: { symbol: 'AAPL', quote: { price: 160, change: 0, changePercentage: 0 } },
        GOOGL: { symbol: 'GOOGL', quote: { price: 110, change: 0, changePercentage: 0 } },
      };

      const holdings = calculateHoldings(transactions, portfolioData);

      expect(holdings).toHaveLength(2);

      const aaplHolding = holdings.find(h => h.symbol === 'AAPL');
      const googlHolding = holdings.find(h => h.symbol === 'GOOGL');

      expect(aaplHolding?.quantity).toBe(10);
      expect(googlHolding?.quantity).toBe(5);
    });

    it('should handle empty portfolioData gracefully', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 10,
          purchase_price: 150,
          purchase_date: '2024-01-01',
          transaction_type: 'buy',
        },
      ];

      const holdings = calculateHoldings(transactions, {});

      expect(holdings).toHaveLength(1);
      expect(holdings[0].assetData.quote?.price).toBe(0); // Default fallback should be 0
    });
  });

  describe('calculateTotalPerformance', () => {
    it('should calculate performance correctly for holdings with gains', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 10,
          purchase_price: 100,
          purchase_date: '2024-01-01',
          transaction_type: 'buy',
        },
      ];

      const holdings = [
        {
          symbol: 'AAPL',
          quantity: 10,
          avgPurchasePrice: 100,
          totalCost: 1000,
          assetData: { symbol: 'AAPL', quote: { price: 120, change: 0, changePercentage: 0 } },
        },
      ] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

      const performance = calculateTotalPerformance(transactions, holdings as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      // Current value: 10 * 120 = 1200
      // Total invested: 1000
      // P/L: 200, P/L%: 20%
      expect(performance.pl).toBe(200);
      expect(performance.percent).toBe(20);
    });

    it('should calculate performance correctly for holdings with losses', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 10,
          purchase_price: 100,
          purchase_date: '2024-01-01',
          transaction_type: 'buy',
        },
      ];

      const holdings = [
        {
          symbol: 'AAPL',
          quantity: 10,
          avgPurchasePrice: 100,
          totalCost: 1000,
          assetData: { symbol: 'AAPL', quote: { price: 80, change: 0, changePercentage: 0 } },
        },
      ] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

      const performance = calculateTotalPerformance(transactions, holdings as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      // Current value: 10 * 80 = 800
      // Total invested: 1000
      // P/L: -200, P/L%: -20%
      expect(performance.pl).toBe(-200);
      expect(performance.percent).toBe(-20);
    });

    it('should include sold positions in performance calculation', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 10,
          purchase_price: 100,
          purchase_date: '2024-01-01',
          transaction_type: 'buy',
        },
        {
          id: 2,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 5,
          purchase_price: 150,
          purchase_date: '2024-02-01',
          transaction_type: 'sell',
        },
      ];

      const holdings = [
        {
          symbol: 'AAPL',
          quantity: 5,
          avgPurchasePrice: 100,
          totalCost: 500,
          assetData: { symbol: 'AAPL', quote: { price: 120, change: 0, changePercentage: 0 } },
        },
      ] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

      const performance = calculateTotalPerformance(transactions, holdings as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      // Total invested: 1000
      // Total sold value: 5 * 150 = 750
      // Current value: 5 * 120 = 600
      // P/L: (600 + 750) - 1000 = 350, P/L%: 35%
      expect(performance.pl).toBe(350);
      expect(performance.percent).toBe(35);
    });

    it('does not count reinvested sale proceeds as new invested capital', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 10,
          purchase_price: 100,
          purchase_date: '2024-01-01',
          transaction_type: 'buy',
        },
        {
          id: 2,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 5,
          purchase_price: 150,
          purchase_date: '2024-02-01',
          transaction_type: 'sell',
        },
        {
          id: 3,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 5,
          purchase_price: 150,
          purchase_date: '2024-03-01',
          transaction_type: 'buy',
        },
      ];
      const holdings = [{
        symbol: 'AAPL',
        quantity: 10,
        avgPurchasePrice: 125,
        totalCost: 1250,
        assetData: { symbol: 'AAPL', quote: { price: 160, change: 0, changePercentage: 0 } },
      }] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

      const performance = calculateTotalPerformance(transactions, holdings);

      expect(performance.pl).toBe(600);
      expect(performance.percent).toBe(60);
    });

    it('should return 0 percent for empty portfolio', () => {
      const transactions: Transaction[] = [];
      const holdings: never[] = [];

      const performance = calculateTotalPerformance(transactions, holdings);

      expect(performance.pl).toBe(0);
      expect(performance.percent).toBe(0);
    });

    it('should handle missing currentPrice gracefully', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          user_id: 'user1',
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 10,
          purchase_price: 100,
          purchase_date: '2024-01-01',
          transaction_type: 'buy',
        },
      ];

      const holdings = [
        {
          portfolio_id: 1,
          symbol: 'AAPL',
          quantity: 10,
          avgPurchasePrice: 100,
          totalCost: 1000,
          assetData: { symbol: 'AAPL', quote: { price: 0, change: 0, changePercentage: 0 } }, // No price available
        },
      ] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

      const performance = calculateTotalPerformance(transactions, holdings as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      // Current value: 0 (no price available)
      // P/L: -1000, P/L%: -100%
      expect(performance.pl).toBe(-1000);
      expect(performance.percent).toBe(-100);
    });
  });
});
