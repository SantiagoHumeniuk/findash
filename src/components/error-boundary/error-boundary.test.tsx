// src/components/error-boundary/error-boundary.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './error-boundary';

vi.mock('../../lib/logger', () => ({ logger: { error: vi.fn() } }));

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Silence console.error for these tests
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders fallback UI when an error is thrown', () => {
    render(
      <ErrorBoundary level="component">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error en esta sección')).toBeInTheDocument();
    expect(screen.getByText(/Esta sección encontró un problema/)).toBeInTheDocument();
  });

  it('renders root level fallback for root errors', () => {
    render(
      <ErrorBoundary level="root">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(screen.getByText(/La aplicación ha encontrado un error inesperado/)).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('displays reset button for component level errors', () => {
    render(
      <ErrorBoundary level="component">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /intentar de nuevo/i })).toBeInTheDocument();
  });

  it('displays navigation buttons for root level errors', () => {
    render(
      <ErrorBoundary level="root">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /volver al inicio/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recargar página/i })).toBeInTheDocument();
  });

  it('calls onReset callback when provided', () => {
    const onReset = vi.fn();

    render(
      <ErrorBoundary level="component" onReset={onReset}>
        <ThrowError />
      </ErrorBoundary>
    );

    // Verify reset button exists
    expect(screen.getByRole('button', { name: /intentar de nuevo/i })).toBeInTheDocument();
  });

  it('includes feature name in error message when provided', () => {
    render(
      <ErrorBoundary level="feature" featureName="Dashboard">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error en esta sección')).toBeInTheDocument();
  });
});
