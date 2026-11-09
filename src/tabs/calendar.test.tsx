// Public tests for the Schedule calendar (fictional data).
import { renderToString } from 'preact-render-to-string'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../engine/defaults'
import type { Settings, Shift } from '../engine/types'
import { gridDates, ScheduleTab, ShiftDetail } from './ScheduleTab'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  pay: { ...DEFAULT_SETTINGS.pay, baseRate: 40, nightPremium: 4, weekendPremium: 3, nightHoursBeforeMidnight: 5 },
  periods: [{ id: '2026_01', start: '2026-03-01', end: '2026-03-14', payDate: '2026-03-25', benefitPay: false }],
  stats: [{ date: '2026-03-06', double: false }],
}
const night: Shift = { id: 'a', date: '2026-03-06', type: 'night', hours: 12, ot: false }
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

describe('calendar grid', () => {
  it('runs from the Sunday on/before the 1st to the Saturday on/after the last day', () => {
    const march = gridDates('2026-03') // Mar 1 2026 is a Sunday, Mar 31 a Tuesday
    expect(march[0]).toBe('2026-03-01')
    expect(march.at(-1)).toBe('2026-04-04')
    expect(march.length % 7).toBe(0)
    const feb = gridDates('2026-02') // Feb 1 2026 is a Sunday, Feb 28 a Saturday: exactly 4 weeks
    expect(feb).toHaveLength(28)
  })

  it('labels days with their shift, stat and payday for screen readers', () => {
    const html = renderToString(<ScheduleTab settings={settings} shifts={[night]} onChange={() => {}} initialMonth="2026-03" />)
    expect(html).toContain('aria-label="Fri Mar 6, Night 12.00 hours, stat holiday"')
    expect(html).toContain('aria-label="Wed Mar 25, payday"')
    expect(text(html)).toContain('March 2026')
  })
})

describe('shift details', () => {
  it('shows type, paid hours, premiums, stat split and pay date', () => {
    const t = text(renderToString(<ShiftDetail shift={night} shifts={[night]} settings={settings} onEdit={() => {}} onDelete={() => {}} />))
    expect(t).toContain('Night shift')
    expect(t).toContain('12.00 paid hours')
    expect(t).toContain('Night differential hours 12.00')
    expect(t).toContain('Weekend premium hours 12.00') // Friday night
    expect(t).toContain('Stat hours (0.5x premium) 5.00') // only the hours before midnight
    expect(t).toContain('paid Mar 25, 2026')
    // 12 x 40 base + 12 x 4 night + 12 x 3 weekend + 5 x 20 stat premium = 480 + 48 + 36 + 100
    expect(t).toContain('$664.00')
  })

  it('marks overtime', () => {
    const t = text(renderToString(<ShiftDetail shift={{ ...night, ot: true }} shifts={[{ ...night, ot: true }]} settings={settings} onEdit={() => {}} onDelete={() => {}} />))
    expect(t).toContain('Overtime')
    expect(t).toContain('Overtime hours 12.00')
  })
})
