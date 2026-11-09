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
  it('shows type and hours, then label | hours | dollars rows, gross and net', () => {
    const t = text(renderToString(<ShiftDetail shift={night} shifts={[night]} settings={settings} onEdit={() => {}} onDelete={() => {}} />))
    expect(t).toContain('Night shift 12.00 h')
    expect(t).toContain('Base 12.00 $480')
    expect(t).toContain('Night diff 12.00 $48')
    expect(t).toContain('Weekend premium 12.00 $36') // Friday night
    expect(t).toContain('Stat premium 5.00 $100') // only the hours before midnight
    expect(t).toContain('Gross (approx.) $664') // 480 + 48 + 36 + 100
    expect(t).toMatch(/Net \(approx\.\) \$[\d,]+/)
    expect(t).not.toContain('paid hours')
  })

  it('marks overtime and shows the OT rate row', () => {
    const ot = { ...night, ot: true }
    const t = text(renderToString(<ShiftDetail shift={ot} shifts={[ot]} settings={settings} onEdit={() => {}} onDelete={() => {}} />))
    expect(t).toContain('Overtime')
    expect(t).toContain('OT 2x 12.00 $960')
  })

  it('a shift with times shows them and is paid by the clock', () => {
    const timed: Shift = { id: 't', date: '2026-03-13', type: 'day', hours: 8, ot: true, start: '07:00', end: '15:00' }
    const t = text(renderToString(<ShiftDetail shift={timed} shifts={[timed]} settings={settings} onEdit={() => {}} onDelete={() => {}} />))
    expect(t).toContain('07:00–15:00')
    expect(t).toContain('OT 2x 8.00 $640')
    expect(t).not.toContain('Weekend premium') // a Friday shift ending at 15:00 earns none
    expect(t).toContain('Gross (approx.) $640')
  })
})
