/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import HomePageRoute from '~/routes/_index'

describe('HomePageRoute', () => {
  it('uses the price and number of reviews to calculate the gross & net revenue.', async () => {
    render(<HomePageRoute />)

    expect(screen.getByTestId('gross-revenue')).toHaveTextContent('$1,038,807')

    await userEvent.clear(screen.getByLabelText('Reviews'))
    await userEvent.type(screen.getByLabelText('Reviews'), '2300')

    await userEvent.clear(screen.getByLabelText('Price'))
    await userEvent.type(screen.getByLabelText('Price'), '6.99')

    expect(screen.getByTestId('gross-revenue')).toHaveTextContent('$723,465')

    expect(screen.getByTestId('net-revenue')).toHaveTextContent('$213,422.18')
  })
})
