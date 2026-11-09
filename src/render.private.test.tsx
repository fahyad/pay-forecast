// Private smoke test: render the real screens with the user's import file and check what they show.
import { existsSync, readFileSync } from 'node:fs'
import { renderToString } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { computeForecast } from './engine/forecast'
import { fmtHours, SHIFT_TYPE_LABELS } from './format'
import { parseData } from './store'
import { PayTab } from './tabs/PayTab'
import { ScheduleTab, ShiftDetail } from './tabs/ScheduleTab'
import { SetupTab } from './tabs/SetupTab'

const FILE = new URL('../private/import.private.json', import.meta.url)
const raw = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : null

describe.skipIf(!raw)('private render check', () => {
  const data = raw ? parseData(raw) : null
  const forecast = data ? computeForecast(data.settings, data.shifts) : null
  const text = (html: string) =>
    html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;|\s+/g, ' ')

  it('Pay tab lists every pay date with its net pay and flags the 2027 pay as an estimate', () => {
    const t = text(renderToString(<PayTab forecast={forecast!} />))
    for (const p of forecast!.periods) {
      const net = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(p.pay!.net / 100)
      expect(t).toContain(net)
    }
    expect(t).toContain('Estimate')
    expect(t).toMatch(/2026 total/)
    console.log(t.slice(0, 600))
  })

  it('Schedule calendar shows every shift in its month, and each shift opens its details', () => {
    const months = [...new Set(data!.shifts.map((s) => s.date.slice(0, 7)))]
    for (const month of months) {
      const html = renderToString(<ScheduleTab settings={data!.settings} shifts={data!.shifts} onChange={() => {}} initialMonth={month} />)
      for (const s of data!.shifts.filter((x) => x.date.startsWith(month))) {
        expect(html).toContain(`${SHIFT_TYPE_LABELS[s.type]} ${fmtHours(s.hours)} hours${s.ot ? ' overtime' : ''}`)
      }
    }
    for (const s of data!.shifts) {
      const t = text(renderToString(<ShiftDetail shift={s} shifts={data!.shifts} settings={data!.settings} onEdit={() => {}} onDelete={() => {}} />))
      expect(t).toContain(`${fmtHours(s.hours)} paid hours`)
      expect(t).toMatch(/paid [A-Z][a-z]{2} \d+, \d{4}/)
      expect(t).toMatch(/Adds to net pay \((approx\.|estimate)\) \$/)
    }
  })

  it('Setup tab renders every section', () => {
    const t = text(renderToString(<SetupTab data={data!} onSettings={() => {}} onReplaceAll={() => {}} />))
    for (const s of ['Pay & premiums', 'Deductions', 'Tax years', 'Pay periods', 'Stat holidays', 'Opening year-to-date', 'Backup']) {
      expect(t).toContain(s)
    }
  })
})
