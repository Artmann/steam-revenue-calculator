/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

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

    render(<GameRoute />)

    expect(screen.getByTestId('title')).toHaveTextContent('Rust')
    expect(screen.getByTestId('description')).toHaveTextContent(
      'A game about rugs and pumpkins.'
    )

    expect(screen.getByText('Gross Revenue')).toBeInTheDocument()
  })
})
