import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AllocationChart } from './allocation-chart';

describe('AllocationChart', () => {
  it('renders sector and country exposure as labeled horizontal bars', () => {
    render(
      <AllocationChart
        data={[
          { name: 'Technology', value: 700, percentage: 70 },
          { name: 'Finance', value: 300, percentage: 30 },
        ]}
        title="Diversificación por sector"
        description="Exposición sectorial"
        type="sector"
      />,
    );

    expect(screen.getByRole('meter', { name: 'Technology' })).toHaveAttribute('aria-valuenow', '70');
    expect(screen.getByRole('meter', { name: 'Finance' })).toHaveAttribute('aria-valuenow', '30');
  });
});
