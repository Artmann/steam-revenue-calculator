// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { useLoaderData } from '@remix-run/react'

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { computeMarketStats, type MarketGame } from '~/market/stats'
import TagRoute, { type LoaderData } from '~/routes/tags.$slug'

vi.mock('@remix-run/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@remix-run/react')>()),
  useLoaderData: vi.fn()
}))

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
  vi.mocked(useLoaderData).mockReturnValue(data as never)

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

  it('keeps top developers and publishers below the stats threshold.', () => {
    renderWith(
      loaderData({ stats: computeMarketStats(games(3)), isFiltered: true })
    )

    expect(screen.getByText('Top developers')).toBeInTheDocument()
    expect(screen.getByText('Top publishers')).toBeInTheDocument()
    expect(screen.queryByTestId('median')).not.toBeInTheDocument()
  })

  it('says no games match when the filters match nothing.', () => {
    renderWith(
      loaderData({ stats: computeMarketStats(games(0)), isFiltered: true })
    )

    expect(screen.getByText('No games match these filters.')).toBeInTheDocument()
    expect(screen.queryByText(/Showing the/)).not.toBeInTheDocument()
  })

  it('puts the headline figures before the filter form.', () => {
    renderWith(loaderData())

    const median = screen.getByTestId('median')
    const select = screen.getByRole('combobox', { name: /price/i })

    expect(
      median.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('keeps every with slug and a custom price when re-submitting.', () => {
    renderWith(
      loaderData({
        isFiltered: true,
        filterValues: {
          price: '10-20',
          since: '',
          until: '',
          with: 'deckbuilder,cards,indie'
        }
      })
    )

    const form = screen.getByRole('combobox', { name: /price/i }).closest('form')!
    const data = new FormData(form)

    expect(data.get('price')).toBe('10-20')
    expect(data.getAll('with')).toEqual(['deckbuilder', 'cards', 'indie'])
  })
})
