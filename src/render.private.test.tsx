// Private smoke test: render the real screens with the user's import file and check what they show.
import { existsSync, readFileSync } from 'node:fs'
import { renderToString } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { computeForecast } from './engine/forecast'
import { fmtDate, fmtDayDate } from './format'
import { parseData } from './store'
import { PayTab } from './tabs/PayTab'
import { ScheduleTab } from './tabs/ScheduleTab'
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

  it('Schedule tab shows every shift under its pay period', () => {
    const t = text(renderToString(<ScheduleTab settings={data!.settings} shifts={data!.shifts} onChange={() => {}} />))
    expect(t).toContain('+ Add shift')
    for (const p of data!.settings.periods) expect(t).toContain(`paid ${fmtDate(p.payDate)}`)
    for (const s of data!.shifts) expect(t).toContain(fmtDayDate(s.date))
    expect(t).not.toContain('Not in any pay period')
  })

  it('Setup tab renders every section', () => {
    const t = text(renderToString(<SetupTab data={data!} onSettings={() => {}} onReplaceAll={() => {}} />))
    for (const s of ['Pay & premiums', 'Deductions', 'Tax years', 'Pay periods', 'Stat holidays', 'Opening year-to-date', 'Backup']) {
      expect(t).toContain(s)
    }
  })
})
