// src/utils/formatters.test.ts

import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercent, formatQuantity, formatNumber } from './formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('should format positive numbers correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(0.99)).toBe('$0.99');
    });

    it('should format negative numbers correctly', () => {
      expect(formatCurrency(-1234.56)).toBe('$-1,234.56');
      expect(formatCurrency(-100)).toBe('$-100.00');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle large numbers', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
      expect(formatCurrency(9999999.99)).toBe('$9,999,999.99');
    });

    it('should round to 2 decimal places', () => {
      expect(formatCurrency(123.456)).toBe('$123.46');
      expect(formatCurrency(123.454)).toBe('$123.45');
    });

    it('should handle null/undefined as 0', () => {
      expect(formatCurrency(null as unknown as number)).toBe('$0.00');
      expect(formatCurrency(undefined as unknown as number)).toBe('$0.00');
    });

    it('should handle very small numbers', () => {
      expect(formatCurrency(0.01)).toBe('$0.01');
      expect(formatCurrency(0.001)).toBe('$0.00');
    });
  });

  describe('formatPercent', () => {
    it('should format positive percentages correctly', () => {
      expect(formatPercent(5.23)).toBe('5.23%');
      expect(formatPercent(100)).toBe('100.00%');
      expect(formatPercent(0.5)).toBe('0.50%');
    });

    it('should format negative percentages correctly', () => {
      expect(formatPercent(-5.23)).toBe('-5.23%');
      expect(formatPercent(-100)).toBe('-100.00%');
    });

    it('should handle zero', () => {
      expect(formatPercent(0)).toBe('0.00%');
    });

    it('should always show 2 decimal places', () => {
      expect(formatPercent(5)).toBe('5.00%');
      expect(formatPercent(5.1)).toBe('5.10%');
      expect(formatPercent(5.123)).toBe('5.12%');
    });

    it('should handle null/undefined as 0', () => {
      expect(formatPercent(null as unknown as number)).toBe('0.00%');
      expect(formatPercent(undefined as unknown as number)).toBe('0.00%');
    });

    it('should handle very large percentages', () => {
      expect(formatPercent(1000)).toBe('1000.00%');
      expect(formatPercent(9999.99)).toBe('9999.99%');
    });
  });

  describe('formatQuantity', () => {
    it('should format whole numbers with 2 decimals minimum', () => {
      expect(formatQuantity(10)).toBe('10.00');
      expect(formatQuantity(1000)).toBe('1,000.00');
    });

    it('should handle numbers with decimals up to 4 places', () => {
      expect(formatQuantity(10.1234)).toBe('10.1234');
      expect(formatQuantity(10.12)).toBe('10.12');
      expect(formatQuantity(10.1)).toBe('10.10');
    });

    it('should round beyond 4 decimal places', () => {
      expect(formatQuantity(10.12345)).toBe('10.1235');
      expect(formatQuantity(10.12344)).toBe('10.1234');
    });

    it('should add thousands separators', () => {
      expect(formatQuantity(1000.5)).toBe('1,000.50');
      expect(formatQuantity(1000000.1234)).toBe('1,000,000.1234');
    });

    it('should handle negative numbers', () => {
      expect(formatQuantity(-10.5)).toBe('-10.50');
      expect(formatQuantity(-1000.1234)).toBe('-1,000.1234');
    });

    it('should handle zero', () => {
      expect(formatQuantity(0)).toBe('0.00');
    });

    it('should handle null/undefined as 0', () => {
      expect(formatQuantity(null as unknown as number)).toBe('0.00');
      expect(formatQuantity(undefined as unknown as number)).toBe('0.00');
    });

    it('should handle very small numbers', () => {
      expect(formatQuantity(0.0001)).toBe('0.0001');
      expect(formatQuantity(0.00001)).toBe('0.00');
    });
  });

  describe('formatNumber', () => {
    it('should format valid numbers to 2 decimal places', () => {
      expect(formatNumber(123.456)).toBe('123.46');
      expect(formatNumber(100)).toBe('100.00');
      expect(formatNumber(0.5)).toBe('0.50');
    });

    it('should handle negative numbers', () => {
      expect(formatNumber(-123.456)).toBe('-123.46');
      expect(formatNumber(-100)).toBe('-100.00');
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0.00');
    });

    it('should return an empty string for non-finite numbers', () => {
      expect(formatNumber(Infinity)).toBe('');
      expect(formatNumber(-Infinity)).toBe('');
      expect(formatNumber(NaN)).toBe('');
    });

    it('should return an empty string for string inputs', () => {
      expect(formatNumber('hello')).toBe('');
      expect(formatNumber('123')).toBe('');
      expect(formatNumber('')).toBe('');
    });

    it('should return an empty string for null/undefined', () => {
      expect(formatNumber(null as unknown as number)).toBe('');
      expect(formatNumber(undefined as unknown as number)).toBe('');
    });

    it('should handle very large numbers', () => {
      expect(formatNumber(1000000)).toBe('1000000.00');
      expect(formatNumber(9999999.99)).toBe('9999999.99');
    });

    it('should handle very small numbers', () => {
      expect(formatNumber(0.001)).toBe('0.00');
      expect(formatNumber(0.0001)).toBe('0.00');
    });
  });
});
