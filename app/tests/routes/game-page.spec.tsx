/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import GameRoute from '~/routes/app.$id.$slug'

import * as remix from '@remix-run/react'

describe('GameRoute', () => {
  it('uses the price and number of reviews to calculate the gross & net revenue.', async () => {
    const spy = jest.spyOn(remix, 'useLoaderData')

    // @ts-ignore
    spy.mockImplementation(() => ({
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
    }))

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
    const spy = jest.spyOn(remix, 'useLoaderData')

    // @ts-ignore
    spy.mockImplementation(() => ({
      game: rust,
      tags: [
        { tagId: 1, name: 'Survival', slug: 'survival', hasPage: true },
        { tagId: 2, name: 'Tiny Tag', slug: 'tiny-tag', hasPage: false }
      ]
    }))

    render(
      <MemoryRouter>
        <GameRoute />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Survival' })).toHaveAttribute('href', '/tags/survival')
    expect(screen.getByText('Tiny Tag').closest('a')).toBeNull()
  })

  it('renders no Metacritic block when there is no score.', () => {
    const spy = jest.spyOn(remix, 'useLoaderData')

    // @ts-ignore
    spy.mockImplementation(() => ({ game: rust, tags: [] }))

    render(
      <MemoryRouter>
        <GameRoute />
      </MemoryRouter>
    )

    expect(screen.queryByText('Metacritic')).not.toBeInTheDocument()
  })
})
