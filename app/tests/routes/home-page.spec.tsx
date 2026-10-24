// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { useLoaderData } from 'react-router'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import HomePageRoute from '~/routes/_index'

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useLoaderData: vi.fn()
}))

describe('HomePageRoute', () => {
  it('uses the price and number of reviews to calculate the gross & net revenue.', async () => {
    vi.mocked(useLoaderData).mockReturnValue({
      popularGames: []
    } as never)

    render(
      <MemoryRouter>
        <HomePageRoute />
      </MemoryRouter>
    )

    expect(screen.getByTestId('gross-revenue')).toHaveTextContent('$831,046')

    await userEvent.clear(screen.getByLabelText('Reviews'))
    await userEvent.type(screen.getByLabelText('Reviews'), '2300')

    await userEvent.clear(screen.getByLabelText('Price (USD)'))
    await userEvent.type(screen.getByLabelText('Price (USD)'), '6.99')

    expect(screen.getByTestId('gross-revenue')).toHaveTextContent('$578,772')

    expect(screen.getByTestId('net-revenue')).toHaveTextContent('$170,737.74')

    expect(screen.getByText('2,300 reviews')).toBeInTheDocument()
    expect(screen.getByText('$6.99')).toBeInTheDocument()
  })
})
