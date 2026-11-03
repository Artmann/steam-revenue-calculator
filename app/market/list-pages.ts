// The game lists page with skip, so MongoDB walks past every earlier game to
// reach a page. Crawlers follow the Next links thousands of pages deep, and
// those reads kept the database busy. No one reads that far, and every game
// page is in the sitemap, so the lists stop here.
export const maxListPages = 50

export function countListPages(itemCount: number, pageSize: number): number {
  return Math.min(Math.max(1, Math.ceil(itemCount / pageSize)), maxListPages)
}

// The page a ?page= value asks for, or null when it is past the last page.
// Anything that is not a positive number is the first page.
export function parseListPage(
  value: string | null,
  pageCount: number
): number | null {
  const page = Math.max(parseInt(value ?? '1', 10) || 1, 1)

  return page > pageCount ? null : page
}
