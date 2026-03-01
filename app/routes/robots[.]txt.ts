export const loader = async () => {
  const content = `User-agent: *
Allow: /

Sitemap: https://steam-revenue-calculator.com/sitemap.xml
`

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain'
    }
  })
}
