import type { ReactElement } from 'react'

export interface FilterValues {
  price: string
  since: string
  until: string
  with: string
}

const priceOptions = [
  ['', 'Any price'],
  ['-5', 'Under $5'],
  ['5-10', '$5–10'],
  ['10-15', '$10–15'],
  ['15-20', '$15–20'],
  ['20-30', '$20–30'],
  ['30-', '$30+']
]

const fieldClassName =
  'bg-transparent border-b border-rule-strong py-1 text-paper focus:outline-hidden focus:border-accent'

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
    values.price !== '' && !priceOptions.some(([value]) => value === values.price)
  const options = hasCustomPrice
    ? [...priceOptions, [values.price, values.price]]
    : priceOptions

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-x-8 gap-y-4 border-y border-rule py-4 text-sm"
      method="get"
    >
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Price</span>
        <select
          className={fieldClassName}
          defaultValue={values.price}
          name="price"
        >
          {options.map(([value, label]) => (
            <option
              key={value}
              value={value}
            >
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Released from</span>
        <input
          className={`${fieldClassName} w-20`}
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
        <input
          className={`${fieldClassName} w-20`}
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
        <select
          className={fieldClassName}
          defaultValue={withSlugs[0] ?? ''}
          name="with"
        >
          <option value="">Any</option>
          {tagOptions.map(({ slug, name }) => (
            <option
              key={slug}
              value={slug}
            >
              {name}
            </option>
          ))}
        </select>
      </label>

      {extraWithSlugs.map((slug) => (
        <input
          key={slug}
          name="with"
          type="hidden"
          value={slug}
        />
      ))}

      <button
        className="text-accent hover:text-accent-strong underline underline-offset-4"
        type="submit"
      >
        Apply
      </button>
      <a
        className="text-paper-muted hover:text-paper"
        href={action}
      >
        Clear
      </a>
    </form>
  )
}
