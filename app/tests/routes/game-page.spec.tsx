// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { useLoaderData } from 'react-router'

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import GameRoute from '~/routes/app.$id.$slug'

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useLoaderData: vi.fn()
}))

describe('GameRoute', () => {
  it('uses the price and number of reviews to calculate the gross & net revenue.', async () => {
    vi.mocked(useLoaderData).mockReturnValue({
      game: {
        id: 1,
        categories: [],
        description: 'A game about rugs and pumpkins.',
        developers: ['Facepunch Studios'],
        genres: [],
        metacritic: {
          score: 74,
          url: ''
        },
        name: 'Rust',
        numberOfReviews: 32,
        publishers: ['Facepunch Studios'],
        price: 3999,
        screenshots: []
      }
    } as never)

    render(
      <MemoryRouter>
        <GameRoute />
      </MemoryRouter>
    )

    expect(screen.getByTestId('title')).toHaveTextContent('Rust')
    expect(screen.getByTestId('description')).toHaveTextContent(
      'A game about rugs and pumpkins.'
    )

    expect(screen.getByText('Estimated gross revenue')).toBeInTheDocument()
  })

  const rust = {
    id: 1,
    categories: [],
    description: 'A game about rugs and pumpkins.',
    developers: ['Facepunch Studios'],
    genres: [],
    metacritic: {},
    name: 'Rust',
    numberOfReviews: 32,
    publishers: ['Facepunch Studios'],
    price: 3999,
    screenshots: []
  }

  it('links tags that have a market page and lists the rest as text.', () => {
    vi.mocked(useLoaderData).mockReturnValue({
      game: rust,
      tags: [
        { tagId: 1, name: 'Survival', slug: 'survival', hasPage: true },
        { tagId: 2, name: 'Tiny Tag', slug: 'tiny-tag', hasPage: false }
      ]
    } as never)

    render(
      <MemoryRouter>
        <GameRoute />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Survival' })).toHaveAttribute('href', '/tags/survival')
    expect(screen.getByText('Tiny Tag').closest('a')).toBeNull()
  })

  it('renders no Metacritic block when there is no score.', () => {
    vi.mocked(useLoaderData).mockReturnValue({ game: rust, tags: [] } as never)

    render(
      <MemoryRouter>
        <GameRoute />
      </MemoryRouter>
    )

    expect(screen.queryByText('Metacritic')).not.toBeInTheDocument()
  })

  it('hides the screenshot and company line when they are missing.', () => {
    vi.mocked(useLoaderData).mockReturnValue({
      game: { ...rust, developers: [], publishers: [] },
      tags: []
    } as never)

    render(
      <MemoryRouter>
        <GameRoute />
      </MemoryRouter>
    )

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText('By')).not.toBeInTheDocument()
  })
})
