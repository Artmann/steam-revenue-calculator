import { getCollection } from './db'

export interface GameRow {
  basePrice: number
  percentPositive?: number
  releaseYear?: number
  reviewCount: number
  revenue: number
  tagIds: number[]
}

export interface TagInfo {
  tagId: number
  name: string
  slug: string
}

// The same games the tag pages are computed from: scraped since tags were
// introduced, with at least one tag.
export async function loadGames(): Promise<GameRow[]> {
  const collection = await getCollection('games')

  const cursor = collection
    .find({ 'tagIds.0': { $exists: true }, basePrice: { $gt: 0 } })
    .project({
      _id: 0,
      basePrice: 1,
      grossRevenue: 1,
      percentPositive: 1,
      releaseYear: 1,
      reviewCount: 1,
      tagIds: 1
    })

  const rows: GameRow[] = []

  for await (const doc of cursor) {
    rows.push({
      basePrice: doc.basePrice,
      percentPositive: doc.percentPositive,
      releaseYear: doc.releaseYear,
      reviewCount: doc.reviewCount ?? 0,
      revenue: doc.grossRevenue ?? 0,
      tagIds: doc.tagIds
    })
  }

  return rows
}

export async function loadTags(): Promise<TagInfo[]> {
  const collection = await getCollection('tags')

  const docs = await collection
    .find({})
    .project({ _id: 0, tagId: 1, name: 1, slug: 1 })
    .toArray()

  return docs.map((doc) => ({
    tagId: doc.tagId,
    name: doc.name,
    slug: doc.slug
  }))
}
