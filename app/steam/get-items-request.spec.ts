import { describe, expect, it } from 'vitest'

import { decodeGetItemsAppIds, encodeGetItemsRequest } from '~/steam/get-items-request'

describe('get items request', () => {
  it('round-trips small and large app ids.', () => {
    const appIds = [10, 127, 128, 16_384, 2_097_152, 3_489_700, 268_435_455]

    expect(decodeGetItemsAppIds(encodeGetItemsRequest(appIds))).toEqual(appIds)
  })

  it('encodes the request Steam was verified against.', () => {
    // The same bytes Steam answered with Counter-Strike's store item.
    expect(encodeGetItemsRequest([10])).toBe(
      Buffer.from([
        0x0a, 0x02, 0x08, 0x0a,
        0x12, 0x0d, 0x0a, 0x07, ...Buffer.from('english'), 0x1a, 0x02, ...Buffer.from('US'),
        0x1a, 0x0a, 0x10, 0x01, 0x28, 0x01, 0x40, 0x14, 0x48, 0x01, 0x50, 0x01
      ]).toString('base64')
    )
  })

  it('keeps a full batch of large app ids under the 8 KB url limit.', () => {
    // Steam's newest app ids sit near 4.5 million; this leaves room to grow.
    const appIds = Array.from({ length: 700 }, (_, index) => 9_999_999 - index)
    const params = new URLSearchParams({
      input_protobuf_encoded: encodeGetItemsRequest(appIds),
      format: 'json'
    })
    const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?${params}`

    expect(url.length).toBeLessThan(7_500)
  })
})
