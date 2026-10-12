import { getCollection } from '~/db'
import { assignTagSlugs, type TagSlug } from '~/market/tag-slugs'
import { fetchTagList } from '~/steam/store-api'

export async function syncTags(): Promise<number> {
  const steamTags = await fetchTagList()

  if (steamTags.length === 0) {
    return 0
  }

  const collection = await getCollection('tags')
  const existing = (await collection
    .find({})
    .project({ _id: 0, tagId: 1, name: 1, slug: 1 })
    .toArray()) as TagSlug[]

  const tags = assignTagSlugs(steamTags, existing)

  await collection.bulkWrite(
    tags.map(({ tagId, name, slug }) => ({
      updateOne: {
        filter: { tagId },
        update: {
          $set: { name, slug },
          $setOnInsert: { gameCount: 0 }
        },
        upsert: true
      }
    })),
    { ordered: false }
  )

  return tags.length
}
