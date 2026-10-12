// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { useLoaderData } from '@remix-run/react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import HomePageRoute from '~/routes/_index'

vi.mock('@remix-run/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@remix-run/react')>()),
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

    await userEvent.clear(screen.getByLabelText('Price'))
    await userEvent.type(screen.getByLabelText('Price'), '6.99')

    expect(screen.getByTestId('gross-revenue')).toHaveTextContent('$578,772')

    expect(screen.getByTestId('net-revenue')).toHaveTextContent('$170,737.74')
  })
})
