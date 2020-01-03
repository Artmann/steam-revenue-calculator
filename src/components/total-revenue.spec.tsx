import '@testing-library/jest-dom/extend-expect'
import { render, waitForElement } from '@testing-library/react';
import React from 'react';

import TotalRevenue from './total-revenue';

describe('TotalRevenue', () => {
  it('displays the total revenue', async () => {
    const { getByTestId } = render(<TotalRevenue revenue={ 25123.12 } />);

    const node = await waitForElement(() => getByTestId('total-revenue'));

    expect(node).toHaveTextContent('$25,123.12');
  });
});
