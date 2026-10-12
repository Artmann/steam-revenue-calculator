declare module '*.mdx' {
  import type { ReactElement } from 'react'

  export default function MDXContent(props: Record<string, unknown>): ReactElement

  export const headers: () => Record<string, string>
}
