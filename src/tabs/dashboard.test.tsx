// Public tests for the Dashboard screen (fictional data).
import { renderToString } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../engine/defaults'
import { computeForecast } from '../engine/forecast'
import type { Settings, Shift } from '../engine/types'
import { fmtDollars, leaveParts } from '../format'
import { DashboardTab } from './DashboardTab'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  pay: { ...DEFAULT_SETTINGS.pay, baseRate: 40, nightPremium: 4 },
  periods: [
    { id: 'A', start: '2026-10-05', end: '2026-10-18', payDate: '2026-10-28', benefitPay: false },
    { id: 'B', start: '2026-10-19', end: '2026-11-01', payDate: '2026-11-10', benefitPay: false },
  ],
}
const shifts: Shift[] = [
  { id: '1', date: '2026-10-06', type: 'day', hours: 12, ot: false },
  { id: '2', date: '2026-10-07', type: 'night', hours: 8, ot: true },
  { id: '3', date: '2026-10-08', type: 'sick', hours: 12, ot: false },
  { id: '4', date: '2026-10-20', type: 'day', hours: 12, ot: false },
]
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
const render = (selected: string[]) =>
  renderToString(<DashboardTab settings={settings} shifts={shifts} selected={selected} onSelect={() => {}} onOpenPay={() => {}} />)

describe('whole-dollar formatting', () => {
  it('rounds half-up from exact cents', () => {
    expect(fmtDollars(185149)).toBe('$1,851')
    expect(fmtDollars(185150)).toBe('$1,852')
    expect(fmtDollars(0)).toBe('$0')
  })
  it('names leave types', () => {
    expect(leaveParts({ sick: 1, vacation: 2, statHoliday: 0 })).toEqual(['1 sick', '2 vacation'])
  })
})

describe('Dashboard tab', () => {
  const nets = computeForecast(settings, shifts).periods.map((p) => p.pay!.net)

  it('one pay: rows and heatmap, no totals card', () => {
    const t = text(render(['A']))
    expect(t).toContain('1 regular · 1 OT · 1 sick')
    expect(t).toContain(fmtDollars(nets[0]))
    expect(t).not.toContain('Net pay')
    expect(t).toContain('2 days worked · 1 sick')
  })

  it('several pays: totals card with regular / overtime tiles', () => {
    const t = text(render(['A', 'B']))
    expect(t).toContain('Net pay')
    expect(t).toContain(fmtDollars(nets[0] + nets[1]))
    expect(t).toMatch(/Regular \$[\d,]+ 2 shifts/)
    expect(t).toMatch(/Overtime \$[\d,]+ 1 shifts/)
  })

  it('heatmap squares describe their day for screen readers', () => {
    const html = render(['A'])
    expect(html).toContain('aria-label="Tue Oct 6: Day · 12.00 h"')
    expect(html).toContain('aria-label="Wed Oct 7: Night · 8.00 h OT"')
    expect(html).toContain('aria-label="Mon Oct 5: Off"')
    expect(html.match(/class="cell /g)).toHaveLength(14)
  })

  it('asks for a selection when none is made', () => {
    expect(text(render([]))).toContain('Tap a pay date to see its breakdown.')
  })
})
