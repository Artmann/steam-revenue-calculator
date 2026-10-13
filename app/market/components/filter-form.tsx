import { useState, type ReactElement } from 'react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '~/components/ui/select'

export interface FilterValues {
  price: string
  since: string
  until: string
  with: string
}

// Radix Select items can't use '' as a value, so "any" stands in for no filter.
const ANY = 'any'

const priceOptions = [
  [ANY, 'Any price'],
  ['-5', 'Under $5'],
  ['5-10', '$5–10'],
  ['10-15', '$10–15'],
  ['15-20', '$15–20'],
  ['20-30', '$20–30'],
  ['30-', '$30+']
]

export function FilterForm({
  action,
  values,
  tagOptions
}: {
  action: string
  values: FilterValues
  tagOptions: { slug: string; name: string }[]
}): ReactElement {
  const withSlugs = values.with
    .split(',')
    .map((slug) => slug.trim())
    .filter(Boolean)
  const extraWithSlugs = withSlugs.slice(1)
  const hasCustomPrice =
    values.price !== '' &&
    !priceOptions.some(([value]) => value === values.price)
  const options = hasCustomPrice
    ? [...priceOptions, [values.price, values.price]]
    : priceOptions
  const [price, setPrice] = useState(values.price || ANY)
  const [withTag, setWithTag] = useState(withSlugs[0] ?? ANY)

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-x-8 gap-y-4 border-y border-rule py-4 text-sm"
      method="get"
    >
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Price</span>
        <Select
          onValueChange={setPrice}
          value={price}
        >
          <SelectTrigger className="min-w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(([value, label]) => (
              <SelectItem
                key={value}
                value={value}
              >
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {price !== ANY && (
          <input
            name="price"
            type="hidden"
            value={price}
          />
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Released from</span>
        <Input
          className="w-20"
          defaultValue={values.since}
          max={2100}
          min={2003}
          name="since"
          placeholder="Any"
          type="number"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Released until</span>
        <Input
          className="w-20"
          defaultValue={values.until}
          max={2100}
          min={2003}
          name="until"
          placeholder="Any"
          type="number"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Also tagged</span>
        <Select
          onValueChange={setWithTag}
          value={withTag}
        >
          <SelectTrigger className="min-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any</SelectItem>
            {tagOptions.map(({ slug, name }) => (
              <SelectItem
                key={slug}
                value={slug}
              >
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {withTag !== ANY && (
          <input
            name="with"
            type="hidden"
            value={withTag}
          />
        )}
      </label>

      {extraWithSlugs.map((slug) => (
        <input
          key={slug}
          name="with"
          type="hidden"
          value={slug}
        />
      ))}

      <Button
        className="h-auto px-0 py-1 underline"
        type="submit"
        variant="link"
      >
        Apply
      </Button>
      <a
        className="text-paper-muted hover:text-paper"
        href={action}
      >
        Clear
      </a>
    </form>
  )
}
