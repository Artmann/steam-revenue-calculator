// GetItems only accepts GET, and Steam rejects URLs over ~8 KB. Protobuf input
// packs an id into at most 7 bytes, against ~33 url-encoded characters as JSON,
// so one request carries 3.5x more ids. `format=json` keeps the response JSON.
//
// Field numbers come from CStoreBrowse_GetItems_Request in Steam's
// service_storebrowse.proto.

const ids = 1
const idAppId = 1

const context = 2
const contextLanguage = 1
const contextCountryCode = 3

const dataRequest = 3
const includeRelease = 2
const includeScreenshots = 5
const includeTagCount = 8
const includeReviews = 9
const includeBasicInfo = 10

const varintWireType = 0
const lengthDelimitedWireType = 2

function varint(value: number): number[] {
  const bytes: number[] = []

  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80)
    value >>>= 7
  }

  bytes.push(value)

  return bytes
}

function varintField(field: number, value: number): number[] {
  return [...varint((field << 3) | varintWireType), ...varint(value)]
}

function messageField(field: number, bytes: number[]): number[] {
  return [
    ...varint((field << 3) | lengthDelimitedWireType),
    ...varint(bytes.length),
    ...bytes
  ]
}

function stringField(field: number, value: string): number[] {
  return messageField(field, [...Buffer.from(value, 'utf8')])
}

export function encodeGetItemsRequest(appIds: number[]): string {
  const bytes = appIds.flatMap((appId) =>
    messageField(ids, varintField(idAppId, appId))
  )

  bytes.push(
    ...messageField(context, [
      ...stringField(contextLanguage, 'english'),
      ...stringField(contextCountryCode, 'US')
    ]),
    ...messageField(dataRequest, [
      ...varintField(includeRelease, 1),
      ...varintField(includeScreenshots, 1),
      ...varintField(includeTagCount, 20),
      ...varintField(includeReviews, 1),
      ...varintField(includeBasicInfo, 1)
    ])
  )

  return Buffer.from(bytes).toString('base64')
}

function readVarint(bytes: Buffer, offset: number): [number, number] {
  let value = 0
  let shift = 0

  for (;;) {
    const byte = bytes[offset++]

    value += (byte & 0x7f) * 2 ** shift
    shift += 7

    if (byte < 0x80) {
      return [value, offset]
    }
  }
}

// Reads the app ids back out of a request. Test fakes use it to answer one.
export function decodeGetItemsAppIds(encoded: string): number[] {
  const bytes = Buffer.from(encoded, 'base64')
  const appIds: number[] = []
  let offset = 0

  while (offset < bytes.length) {
    const [key, afterKey] = readVarint(bytes, offset)
    const [length, afterLength] = readVarint(bytes, afterKey)

    offset = afterLength + length

    if (key >> 3 === ids) {
      // An id message holds only the appid varint field.
      appIds.push(readVarint(bytes, afterLength + 1)[0])
    }
  }

  return appIds
}
