// Private check: dashboard summary against the user's real data (git-ignored import file; skipped when absent).
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { summarizeDashboard } from './dashboard'
import { computeForecast } from './forecast'
import type { Settings, Shift } from './types'

const IMPORT = new URL('../../private/import.private.json', import.meta.url)
const data: { settings: Settings; shifts: Shift[] } | null = existsSync(IMPORT) ? JSON.parse(readFileSync(IMPORT, 'utf8')) : null

describe.skipIf(!data)('private dashboard check', () => {
  const ids = data ? data.settings.periods.map((p) => p.id) : []
  const d = data ? summarizeDashboard(data.settings, data.shifts, ids) : null
  const forecast = data ? computeForecast(data.settings, data.shifts) : null

  it('every cycle net equals the Pay tab net, and the total is their sum', () => {
    for (const c of d!.cycles) expect(c.net).toBe(forecast!.periods.find((p) => p.period.id === c.period.id)!.pay!.net)
    expect(d!.net).toBe(forecast!.periods.reduce((t, p) => t + p.pay!.net, 0))
  })

  it('counts match the schedule and no worked day shows as off', () => {
    const worked = data!.shifts.filter((s) => ['day', 'evening', 'night'].includes(s.type))
    expect(d!.regular + d!.overtime).toBe(worked.length)
    expect(d!.overtime).toBe(worked.filter((s) => s.ot).length)
    const cells = new Map(d!.cycles.flatMap((c) => c.days.map((x) => [x.date, x.kind])))
    for (const s of worked) expect(cells.get(s.date)).not.toBe('off')
  })

  it('prints a sample selection', () => {
    const pick = data!.settings.periods.slice(-5, -2).map((p) => p.id)
    const s = summarizeDashboard(data!.settings, data!.shifts, pick)
    console.log(JSON.stringify({
      pick, net: s.net / 100, regular: s.regular, overtime: s.overtime, regularAdds: s.regularAdds / 100,
      overtimeAdds: s.overtimeAdds / 100, daysWorked: s.daysWorked, leaveDays: s.leaveDays,
      rows: s.cycles.map((c) => [c.period.payDate, c.regular, c.overtime, c.leave, (c.net ?? 0) / 100]),
    }))
  })
})
