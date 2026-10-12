// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { useLoaderData } from '@remix-run/react'

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import TagsIndexRoute from '~/routes/tags._index'

vi.mock('@remix-run/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@remix-run/react')>()),
  useLoaderData: vi.fn()
}))

describe('TagsIndexRoute', () => {
  it('lists tags with links and figures.', () => {
    vi.mocked(useLoaderData).mockReturnValue({
      sort: 'median',
      tags: [
        { name: 'Roguelike', slug: 'roguelike', gameCount: 1200, median: 42_000, shareAboveHundredThousand: 0.31 }
      ]
    } as never)

    render(
      <MemoryRouter>
        <TagsIndexRoute />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Roguelike' })).toHaveAttribute('href', '/tags/roguelike')
    expect(screen.getByText('$42K')).toBeInTheDocument()
    expect(screen.getByText('31%')).toBeInTheDocument()
  })
})
