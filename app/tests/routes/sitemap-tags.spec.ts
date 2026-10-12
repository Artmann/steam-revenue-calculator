import { getCollection } from '~/db'
import { loader } from '~/routes/sitemap-tags[.]xml'

jest.mock('~/db', () => ({ getCollection: jest.fn() }))

describe('sitemap-tags loader', () => {
  it('lists static pages and tags with stats, escaping slugs.', async () => {
    const find = jest.fn().mockReturnValue({
      sort: () => ({
        project: () => ({
          toArray: async () => [{ slug: 'roguelike' }, { slug: 'a&b<c>' }]
        })
      })
    })

    ;(getCollection as jest.Mock).mockResolvedValue({ find })

    const response = await loader()
    const xml = await response.text()

    expect(find).toHaveBeenCalledWith({ stats: { $exists: true } })
    expect(response.headers.get('Content-Type')).toContain('application/xml')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/tags</loc>')
    expect(xml).toContain('<loc>https://steam-revenue-calculator.com/about</loc>')
    expect(xml).toContain(
      '<loc>https://steam-revenue-calculator.com/tags/roguelike</loc>'
    )
    expect(xml).toContain('/tags/a&amp;b&lt;c&gt;</loc>')
    expect(xml).not.toContain('a&b<c>')
    expect(xml).not.toContain('/app/')
  })
})
