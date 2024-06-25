/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as remix from '@remix-run/react'

import HomePageRoute from '~/routes/_index'

describe('HomePageRoute', () => {
  it('uses the price and number of reviews to calculate the gross & net revenue.', async () => {
    const spy = jest.spyOn(remix, 'useLoaderData')

    // @ts-ignore
    spy.mockImplementation(() => ({
      popularGames: []
    }))

    render(
      <MemoryRouter>
        <HomePageRoute />
      </MemoryRouter>
    )

    expect(screen.getByTestId('gross-revenue')).toHaveTextContent('$831,046')

    await userEvent.clear(screen.getByLabelText('Reviews'))
    await userEvent.type(screen.getByLabelText('Reviews'), '2300')

    await userEvent.clear(screen.getByLabelText('Price'))
    await userEvent.type(screen.getByLabelText('Price'), '6.99')

    expect(screen.getByTestId('gross-revenue')).toHaveTextContent('$578,772')

    expect(screen.getByTestId('net-revenue')).toHaveTextContent('$170,737.74')
  })
})
