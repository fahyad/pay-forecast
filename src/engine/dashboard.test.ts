// Public tests for the dashboard summary (fictional data).
import { describe, expect, it } from 'vitest'
import { defaultSelection, summarizeDashboard } from './dashboard'
import { DEFAULT_SETTINGS } from './defaults'
import { computeForecast } from './forecast'
import type { Settings, Shift } from './types'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  pay: { ...DEFAULT_SETTINGS.pay, baseRate: 40, eveningPremium: 2, nightPremium: 4, weekendPremium: 3, eveningHoursPerDayShift: 4.25, nightHoursBeforeMidnight: 5 },
  deductions: {
    ...DEFAULT_SETTINGS.deductions,
    unionDuesRate: 0.01, unionLevy: 2, lappRateLow: 0.05, lappRateHigh: 0.08, tfsaEmployeeRate: 0.02, tfsaEmployerRate: 0.02,
    benefitPremiums: [{ name: 'Plan', amount: 10 }],
  },
  periods: [
    { id: 'B', start: '2026-10-19', end: '2026-11-01', payDate: '2026-11-10', benefitPay: false },
    { id: 'A', start: '2026-10-05', end: '2026-10-18', payDate: '2026-10-28', benefitPay: true },
  ],
  opening: { year: 2026, cpp: 4230.45, cpp2: 416, ei: 1123.07, pensionableEarnings: 90000 },
}
const s = (id: string, date: string, type: Shift['type'], hours: number, ot = false): Shift => ({ id, date, type, hours, ot })
const shifts: Shift[] = [
  s('r1', '2026-10-06', 'day', 12),
  s('o1', '2026-10-07', 'night', 8, true),
  s('l1', '2026-10-08', 'sick', 11.63),
  s('r2', '2026-10-09', 'night', 11.63), // a regular shift with an OT block on the same day
  s('o2', '2026-10-09', 'night', 4, true),
  s('r3', '2026-10-20', 'day', 12),
]
const netOf = (list: Shift[], id: string) => computeForecast(settings, list).periods.find((p) => p.period.id === id)!.pay!.net
const totalNet = (list: Shift[]) => computeForecast(settings, list).periods.reduce((t, p) => t + p.pay!.net, 0)

describe('dashboard summary', () => {
  it('counts regular, overtime and leave per cycle', () => {
    const [a] = summarizeDashboard(settings, shifts, ['A']).cycles
    expect(a).toMatchObject({ regular: 2, overtime: 2, leave: { sick: 1 } })
    expect(a.net).toBe(netOf(shifts, 'A'))
  })

  it('builds one heatmap cell per day of the cycle', () => {
    const [a] = summarizeDashboard(settings, shifts, ['A']).cycles
    expect(a.days).toHaveLength(14)
    const kind = (d: string) => a.days.find((x) => x.date === d)!.kind
    expect(kind('2026-10-05')).toBe('off')
    expect(kind('2026-10-06')).toBe('regular')
    expect(kind('2026-10-07')).toBe('overtime')
    expect(kind('2026-10-08')).toBe('leave')
    expect(kind('2026-10-09')).toBe('regular') // regular + OT block: shown as a regular day
    expect(a.days.find((x) => x.date === '2026-10-09')!.shifts.map((x) => x.id)).toEqual(['r2', 'o2'])
  })

  it('totals several cycles in pay-date order and counts days worked once per date', () => {
    const d = summarizeDashboard(settings, shifts, ['B', 'A'])
    expect(d.cycles.map((c) => c.period.id)).toEqual(['A', 'B'])
    expect(d.net).toBe(netOf(shifts, 'A') + netOf(shifts, 'B'))
    expect(d).toMatchObject({ regular: 3, overtime: 2, daysWorked: 4, leaveDays: 1, estimate: false, missing: [] })
  })

  it('regular / overtime "adds" = net with the group minus net without the whole group', () => {
    const d = summarizeDashboard(settings, shifts, ['A'])
    const withoutRegularA = shifts.filter((x) => !['r1', 'r2'].includes(x.id))
    const withoutOtA = shifts.filter((x) => !['o1', 'o2'].includes(x.id))
    expect(d.regularAdds).toBe(totalNet(shifts) - totalNet(withoutRegularA))
    expect(d.overtimeAdds).toBe(totalNet(shifts) - totalNet(withoutOtA))
    expect(d.overtimeAdds).toBeGreaterThan(0)
  })

  it('a cycle with no overtime adds nothing for overtime', () => {
    expect(summarizeDashboard(settings, shifts, ['B']).overtimeAdds).toBe(0)
  })

  it('flags cycles that cannot be calculated', () => {
    const noRates = { ...settings, taxYears: [] }
    const d = summarizeDashboard(noRates, shifts, ['A'])
    expect(d.missing.map((p) => p.id)).toEqual(['A'])
    expect(d.cycles[0].net).toBeNull()
  })
})

describe('default selection', () => {
  it('picks the next pay on or after today, else the latest, else nothing', () => {
    expect(defaultSelection(settings.periods, '2026-10-29')).toEqual(['B'])
    expect(defaultSelection(settings.periods, '2026-10-28')).toEqual(['A'])
    expect(defaultSelection(settings.periods, '2027-01-01')).toEqual(['B'])
    expect(defaultSelection([], '2026-10-01')).toEqual([])
  })
})
