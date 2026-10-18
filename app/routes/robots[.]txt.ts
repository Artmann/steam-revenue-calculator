export const loader = async () => {
  // Filtered tag pages compute stats on the fly and are noindex anyway, and
  // their filter combinations are endless.
  const content = `User-agent: *
Allow: /
Disallow: /*?*price=
Disallow: /*?*since=
Disallow: /*?*until=
Disallow: /*?*with=

Sitemap: https://steam-revenue-calculator.com/sitemap.xml
Sitemap: https://steam-revenue-calculator.com/sitemap-tags.xml
`

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain'
    }
  })
}
