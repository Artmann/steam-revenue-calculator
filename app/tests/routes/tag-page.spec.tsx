/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import * as remix from '@remix-run/react'

import { computeMarketStats, type MarketGame } from '~/market/stats'
import TagRoute, { type LoaderData } from '~/routes/tags.$slug'

function games(count: number): MarketGame[] {
  return Array.from({ length: count }, (_, index) => ({
    gameId: index + 1,
    name: `Roguelike ${index + 1}`,
    slug: `roguelike-${index + 1}`,
    grossRevenue: (index + 1) * 10_000,
    basePrice: 1499,
    releaseYear: 2020 + (index % 3),
    tagIds: [1],
    reviewCount: 100,
    developers: [`Studio ${index % 2}`],
    publishers: ['Pub'],
  }))
}

function loaderData(overrides: Partial<LoaderData> = {}): LoaderData {
  const stats = computeMarketStats(games(12))

  return {
    tag: { name: 'Roguelike', slug: 'roguelike' },
    stats,
    baseline: computeMarketStats(games(40)),
    statsUpdatedAt: '2026-10-12T00:00:00.000Z',
    isFiltered: false,
    filterValues: { price: '', since: '', until: '', with: '' },
    unknownTags: [],
    relatedTags: [
      { tagId: 2, name: 'Deckbuilder', slug: 'deckbuilder', hasPage: true, count: 6, lift: 4 }
    ],
    tagOptions: [{ slug: 'deckbuilder', name: 'Deckbuilder' }],
    ...overrides
  }
}

function renderWith(data: LoaderData) {
  const spy = jest.spyOn(remix, 'useLoaderData')

  // @ts-ignore
  spy.mockImplementation(() => data)

  render(
    <MemoryRouter>
      <TagRoute />
    </MemoryRouter>
  )
}

describe('TagRoute', () => {
  it('shows headline figures, top games and related tags.', () => {
    renderWith(loaderData())

    expect(screen.getByTestId('title')).toHaveTextContent(
      'How much do Roguelike games make on Steam?'
    )
    expect(screen.getByTestId('median')).toHaveTextContent('$65K')
    expect(screen.getByText('Roguelike 12')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Deckbuilder' })).toHaveAttribute(
      'href',
      '/tags/deckbuilder'
    )
    expect(screen.getByTestId('distribution')).toBeInTheDocument()
  })

  it('hides the statistics for small filtered samples but keeps the game list.', () => {
    renderWith(
      loaderData({ stats: computeMarketStats(games(3)), isFiltered: true })
    )

    expect(screen.getByText(/not enough games/i)).toBeInTheDocument()
    expect(screen.queryByTestId('distribution')).not.toBeInTheDocument()
    expect(screen.getByText('Roguelike 3')).toBeInTheDocument()
  })

  it('lists unknown tags from the filter.', () => {
    renderWith(loaderData({ unknownTags: ['nope'], isFiltered: true }))

    expect(screen.getByText(/nope/)).toBeInTheDocument()
  })
})
