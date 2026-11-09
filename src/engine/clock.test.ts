// Public tests for clock-based premiums (UNA-AHS collective agreement, Article 28). Fictional data.
import { describe, expect, it } from 'vitest'
import { clockPremiums, kindFromTimes, suggestedPaidHours } from './clock'
import { DEFAULT_SETTINGS } from './defaults'
import { shiftHours } from './schedule'
import type { PayRules, StatHoliday } from './types'

const pay: PayRules = { ...DEFAULT_SETTINGS.pay, twelveHourPaid: 11.63 }
// 2026-11-04 Wednesday, 2026-11-06 Friday, 2026-11-07 Saturday, 2026-11-08 Sunday.
const p = (date: string, start: string, end: string, ot = false, paid = 11.63, stats: StatHoliday[] = []) =>
  clockPremiums(date, start, end, ot, Math.round(paid * 100), pay, stats)

describe('regular shifts', () => {
  it('day 07:15-19:15: the 4.25 hours after 15:00 get the evening premium', () => {
    expect(p('2026-11-04', '07:15', '19:15')).toMatchObject({ evening: 425, night: 0, weekend: 0 })
  })
  it('night 19:00-07:00: majority in 23:00-07:00, so every paid hour gets night differential', () => {
    expect(p('2026-11-04', '19:00', '07:00')).toMatchObject({ evening: 0, night: 1163, weekend: 0 })
  })
  it('Friday day: 4.25 weekend hours after Friday 15:00; Friday night: the whole shift', () => {
    expect(p('2026-11-06', '07:15', '19:15').weekend).toBe(425)
    expect(p('2026-11-06', '19:00', '07:00').weekend).toBe(1163)
  })
  it('Sunday night 19:00-07:00 is all inside the weekend window (to Monday 07:00)', () => {
    expect(p('2026-11-08', '19:00', '07:00').weekend).toBe(1163)
  })
  it('a shift ending between 15:00 and 17:00 gets no evening premium', () => {
    expect(p('2026-11-04', '08:00', '16:00', false, 8).evening).toBe(0)
    expect(p('2026-11-04', '07:00', '15:00', false, 8).evening).toBe(0)
  })
  it('otherwise each hour in a window counts, but only when more than one hour falls there', () => {
    expect(p('2026-11-04', '10:00', '17:30', false, 7.5).evening).toBe(250)
    expect(p('2026-11-04', '13:00', '17:30', false, 4.5).evening).toBe(450) // 2.5 of 4.5 h is a majority: whole shift
    expect(p('2026-11-04', '04:00', '12:00', false, 8).night).toBe(300)
    expect(p('2026-11-04', '06:30', '14:30', false, 8).night).toBe(0)
  })
})

describe('overtime', () => {
  it('19:00-03:00 on a Saturday: 4 evening + 4 night + 8 weekend', () => {
    expect(p('2026-11-07', '19:00', '03:00', true, 8)).toMatchObject({ evening: 400, night: 400, weekend: 800 })
  })
  it('07:00-15:00 on a Friday: no evening and no weekend hours (both windows start at 15:00)', () => {
    expect(p('2026-11-06', '07:00', '15:00', true, 8)).toMatchObject({ evening: 0, night: 0, weekend: 0 })
  })
  it('23:00-07:00 on a Sunday: 8 night + 8 weekend', () => {
    expect(p('2026-11-08', '23:00', '07:00', true, 8)).toMatchObject({ evening: 0, night: 800, weekend: 800 })
  })
  it('counts even a short block in a window', () => {
    expect(p('2026-11-04', '14:00', '15:30', true, 1.5).evening).toBe(50)
  })
})

describe('stat hours by the clock', () => {
  const stats: StatHoliday[] = [{ date: '2026-11-11', double: false }, { date: '2026-12-25', double: true }]
  it('night starting on the stat: 19:00-24:00 = 5.00', () => {
    expect(p('2026-11-11', '19:00', '07:00', false, 11.63, stats).stats).toEqual([{ date: '2026-11-11', double: false, hours: 500 }])
  })
  it('night starting the evening before: 00:00-07:00 = 7.00', () => {
    expect(p('2026-11-10', '19:00', '07:00', false, 11.63, stats).stats).toEqual([{ date: '2026-11-11', double: false, hours: 700 }])
  })
  it('a day shift on a double stat is capped at its paid hours', () => {
    expect(p('2026-12-25', '07:15', '19:15', false, 11.63, stats).stats).toEqual([{ date: '2026-12-25', double: true, hours: 1163 }])
  })
})

describe('paid hours and shift kind', () => {
  it('a 12-hour regular shift pays the set amount; overtime and other lengths pay clock hours', () => {
    expect(suggestedPaidHours('07:15', '19:15', false, pay)).toBe(11.63)
    expect(suggestedPaidHours('19:00', '07:00', true, pay)).toBe(12)
    expect(suggestedPaidHours('07:00', '15:00', true, pay)).toBe(8)
    expect(suggestedPaidHours('07:00', '15:00', false, pay)).toBe(8)
    expect(suggestedPaidHours('09:00', '13:15', true, pay)).toBe(4.25)
  })
  it('names the shift by where most of its hours fall', () => {
    expect(kindFromTimes('07:15', '19:15', pay)).toBe('day')
    expect(kindFromTimes('15:00', '23:00', pay)).toBe('evening')
    expect(kindFromTimes('19:00', '07:00', pay)).toBe('night')
  })
})

describe('shiftHours uses the clock when times are set', () => {
  const base = { id: 'a', date: '2026-11-06', type: 'day' as const, hours: 8, ot: true }
  it('timed OT day on a Friday: no evening or weekend; untimed: the old estimates', () => {
    const est = { ...pay, eveningHoursPerDayShift: 4.25, fridayDayWeekendHours: 4.25 }
    expect(shiftHours({ ...base, start: '07:00', end: '15:00' }, est, [])).toMatchObject({ ot: 800, evening: 0, weekend: 0 })
    expect(shiftHours(base, est, [])).toMatchObject({ ot: 800, evening: 425, weekend: 425 })
  })
})
