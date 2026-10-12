/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import * as remix from '@remix-run/react'

import TagsIndexRoute from '~/routes/tags._index'

describe('TagsIndexRoute', () => {
  it('lists tags with links and figures.', () => {
    const spy = jest.spyOn(remix, 'useLoaderData')

    // @ts-ignore
    spy.mockImplementation(() => ({
      sort: 'median',
      tags: [
        { name: 'Roguelike', slug: 'roguelike', gameCount: 1200, median: 42_000, shareAboveHundredThousand: 0.31 }
      ]
    }))

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
