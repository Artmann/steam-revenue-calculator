import '@testing-library/jest-dom/extend-expect'
import { fireEvent, render } from '@testing-library/react';
import React from 'react';

import App from './app';

describe('Breakdown', () => {
  it('displays the total revenue', async () => {
    const { getByTestId } = render(<App />);

    fireEvent.change(getByTestId('review-input'), { currentTarget: { value: '789' } });
    fireEvent.change(getByTestId('price-input'), { currentTarget: { value: '7.99' } });

    expect(getByTestId('total-revenue')).toHaveTextContent('$295,880.85');
    expect(getByTestId('gross-revenue')).toHaveTextContent('$295,881.00');
    expect(getByTestId('net-revenue')).toHaveTextContent('$97,560.00');
  });
});
