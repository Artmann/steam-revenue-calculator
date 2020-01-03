import '@testing-library/jest-dom/extend-expect'
import { render } from '@testing-library/react';
import React from 'react';

import Breakdown from './breakdown';

describe('Breakdown', () => {
  it('displays the total revenue', async () => {
    const { getByTestId } = render(<Breakdown grossRevenue={ 100000 } />);

    expect(getByTestId('gross-revenue')).toHaveTextContent('$100,000.00');
    expect(getByTestId('vat')).toHaveTextContent('$20,000.00');
    expect(getByTestId('returns')).toHaveTextContent('$6,400.00');
    expect(getByTestId('regional-pricing')).toHaveTextContent('$14,720.00');
    expect(getByTestId('discounts')).toHaveTextContent('$11,776.00');
    expect(getByTestId('platform')).toHaveTextContent('$14,131.00');
    expect(getByTestId('net-revenue')).toHaveTextContent('$32,973.00');
  });
});
