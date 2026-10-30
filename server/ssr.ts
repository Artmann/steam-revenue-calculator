import { createRequestHandler } from 'react-router'

import { markedUnavailable, withDeadline } from '~/http/unavailable'

const handler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE
)

// The Express server this replaces appended `charset=utf-8` to text
// responses that set a bare content type. Keep that so headers stay the same.
function withCharset(response: Response): Response {
  const contentType = response.headers.get('content-type')

  if (contentType?.startsWith('text/') && !contentType.includes('charset')) {
    response.headers.set('content-type', `${contentType}; charset=utf-8`)
  }

  return response
}

export default {
  fetch: async (request: Request) =>
    withCharset(
      await withDeadline(async () =>
        markedUnavailable(request, await handler(request))
      )
    )
}
