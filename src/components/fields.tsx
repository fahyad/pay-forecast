import { useEffect, useState } from 'preact/hooks'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  /** Shown value = stored value x scale (100 for percentages). */
  scale?: number
  suffix?: string
  prefix?: string
  step?: string
  hint?: string
}

/** Number input that keeps the user's partial typing and only commits valid numbers. */
export function NumberField({ label, value, onChange, scale = 1, suffix, prefix, step = 'any', hint }: NumberFieldProps) {
  const shown = (v: number) => String(Math.round(v * scale * 1e6) / 1e6)
  const [text, setText] = useState(shown(value))
  useEffect(() => setText(shown(value)), [value, scale])
  return (
    <label class="field">
      <span class="field-label">{label}</span>
      <span class="field-input">
        {prefix && <span class="affix">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={text}
          onInput={(e) => {
            const t = (e.target as HTMLInputElement).value
            setText(t)
            const n = Number(t)
            if (t.trim() !== '' && Number.isFinite(n)) onChange(n / scale)
          }}
          onBlur={() => setText(shown(value))}
        />
        {suffix && <span class="affix">{suffix}</span>}
      </span>
      {hint && <span class="field-hint">{hint}</span>}
    </label>
  )
}

export const PercentField = (p: Omit<NumberFieldProps, 'scale' | 'suffix'>) => (
  <NumberField {...p} scale={100} suffix="%" />
)

export const MoneyField = (p: Omit<NumberFieldProps, 'prefix'>) => <NumberField {...p} prefix="$" />

export function TextField(p: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label class="field">
      <span class="field-label">{p.label}</span>
      <span class="field-input">
        <input type="text" value={p.value} onInput={(e) => p.onChange((e.target as HTMLInputElement).value)} />
      </span>
    </label>
  )
}

export function DateField(p: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label class="field">
      <span class="field-label">{p.label}</span>
      <span class="field-input">
        <input type="date" value={p.value} onInput={(e) => {
          const v = (e.target as HTMLInputElement).value
          if (v) p.onChange(v)
        }} />
      </span>
    </label>
  )
}

export function Toggle(p: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label class="toggle">
      <span>
        <span class="field-label">{p.label}</span>
        {p.hint && <span class="field-hint">{p.hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={p.checked} onChange={(e) => p.onChange((e.target as HTMLInputElement).checked)} />
    </label>
  )
}
