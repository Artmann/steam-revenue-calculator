export async function health(): Promise<{ checkedAt: string }> {
  'use workflow'

  const checkedAt = await recordCheck()

  return { checkedAt }
}

async function recordCheck(): Promise<string> {
  'use step'

  return new Date().toISOString()
}
