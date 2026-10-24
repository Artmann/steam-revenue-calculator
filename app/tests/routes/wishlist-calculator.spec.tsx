// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import WishlistCalculatorRoute from '~/routes/wishlist-calculator'

describe('WishlistCalculatorRoute', () => {
  it('updates the sentence and the estimates from the inputs.', async () => {
    render(
      <MemoryRouter>
        <WishlistCalculatorRoute />
      </MemoryRouter>
    )

    expect(screen.getByText('10,000 wishlists')).toBeInTheDocument()
    const initialSales = screen.getByTestId('year-sales').textContent

    await userEvent.clear(screen.getByLabelText('Wishlists at launch'))
    await userEvent.type(screen.getByLabelText('Wishlists at launch'), '20000')

    await userEvent.clear(screen.getByLabelText('Price (USD)'))
    await userEvent.type(screen.getByLabelText('Price (USD)'), '4.99')

    expect(screen.getByText('20,000 wishlists')).toBeInTheDocument()
    expect(screen.getByText('$4.99')).toBeInTheDocument()
    expect(screen.getByTestId('year-sales').textContent).not.toBe(initialSales)
  })
})
