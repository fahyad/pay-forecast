// Shifts -> per-period earnings lines (the sheet's Work Schedule columns H:N, summed per pay date).
import { clockPremiums } from './clock'
import { toHundredths } from './money'
import type { EarningsLine, LeaveShiftType, PayPeriod, PayRules, PeriodInput, Shift, StatHoliday } from './types'

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 0 = Sunday ... 6 = Saturday. */
export const weekday = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay()

export const periodForDate = (date: string, periods: PayPeriod[]): PayPeriod | undefined =>
  periods.find((p) => p.start <= date && date <= p.end)

const LEAVE_LINES: Record<LeaveShiftType, { code: string; label: string }> = {
  sick: { code: 'SICK', label: 'Sick Time' },
  statHoliday: { code: 'STATHOL', label: 'Stat Holiday' },
  vacation: { code: 'VAC', label: 'Vacation' },
  orientation: { code: 'ORIENT', label: 'Orientation' },
  personalLeave: { code: 'PERS', label: 'Personal Leave Day Taken' },
  floaterStat: { code: 'FLOAT', label: 'Floater Stat Taken' },
}

/** Hours a single shift contributes, in hundredths of an hour. */
export interface ShiftHours {
  regular: number
  statWorked: number
  leave: Partial<Record<LeaveShiftType, number>>
  ot: number
  evening: number
  night: number
  weekend: number
  statPremium: number
  statPremiumDouble: number
}

export function shiftHours(shift: Shift, pay: PayRules, stats: StatHoliday[]): ShiftHours {
  const h = toHundredths(shift.hours)
  const out: ShiftHours = {
    regular: 0, statWorked: 0, leave: {}, ot: 0, evening: 0, night: 0, weekend: 0, statPremium: 0, statPremiumDouble: 0,
  }
  if (shift.type === 'unpaid' || h <= 0) return out
  if (shift.type !== 'day' && shift.type !== 'evening' && shift.type !== 'night') {
    out.leave[shift.type] = h
    return out
  }

  // With clock times: premiums and stat hours by the collective agreement's rules.
  if (shift.start && shift.end) {
    const c = clockPremiums(shift.date, shift.start, shift.end, shift.ot, h, pay, stats)
    let statHours = 0
    for (const st of c.stats) {
      if (st.double) out.statPremiumDouble += st.hours
      else out.statPremium += st.hours
      statHours += st.hours
    }
    if (shift.ot) out.ot = h
    else {
      out.statWorked = statHours
      out.regular = h - statHours
    }
    out.evening = c.evening
    out.night = c.night
    out.weekend = c.weekend
    return out
  }

  // Without times: estimates from the shift type.

  const statOn = (date: string) => stats.find((s) => s.date === date)
  const addStat = (date: string, hours: number) => {
    const stat = statOn(date)
    if (!stat || hours <= 0) return 0
    if (stat.double) out.statPremiumDouble += hours
    else out.statPremium += hours
    return hours
  }

  // Stat pay only for hours that fall on the stat date; a night shift is split at midnight.
  let statHours = 0
  if (shift.type === 'night') {
    const before = Math.min(h, toHundredths(pay.nightHoursBeforeMidnight))
    statHours += addStat(shift.date, before)
    statHours += addStat(addDays(shift.date, 1), h - before)
  } else {
    statHours += addStat(shift.date, h)
  }

  if (shift.ot) {
    out.ot = h
  } else {
    out.statWorked = statHours
    out.regular = h - statHours
  }

  if (shift.type === 'day') out.evening = Math.min(h, toHundredths(pay.eveningHoursPerDayShift))
  if (shift.type === 'evening') out.evening = h
  if (shift.type === 'night') out.night = h

  const dow = weekday(shift.date)
  if (dow === 0 || dow === 6) out.weekend = h
  else if (dow === 5 && shift.type === 'night') out.weekend = h
  else if (dow === 5 && shift.type === 'day') out.weekend = Math.min(h, toHundredths(pay.fridayDayWeekendHours))

  return out
}

/** Earnings lines for a set of shifts (all in one pay period). */
export function periodInput(shifts: Shift[], pay: PayRules, stats: StatHoliday[]): PeriodInput {
  const t: ShiftHours = {
    regular: 0, statWorked: 0, leave: {}, ot: 0, evening: 0, night: 0, weekend: 0, statPremium: 0, statPremiumDouble: 0,
  }
  for (const s of shifts) {
    const sh = shiftHours(s, pay, stats)
    t.regular += sh.regular
    t.statWorked += sh.statWorked
    t.ot += sh.ot
    t.evening += sh.evening
    t.night += sh.night
    t.weekend += sh.weekend
    t.statPremium += sh.statPremium
    t.statPremiumDouble += sh.statPremiumDouble
    for (const [k, v] of Object.entries(sh.leave) as [LeaveShiftType, number][]) t.leave[k] = (t.leave[k] ?? 0) + v
  }
  const hrs = (hundredths: number) => hundredths / 100
  const lines: EarningsLine[] = [
    { code: 'REG', label: 'Regular Pay', hours: hrs(t.regular), rate: pay.baseRate, baseRate: true },
    { code: 'STAT1X', label: 'Stat Wrkd Paid 1X Reg', hours: hrs(t.statWorked), rate: pay.baseRate, baseRate: true },
    ...(Object.keys(LEAVE_LINES) as LeaveShiftType[]).map((k) => ({
      ...LEAVE_LINES[k], hours: hrs(t.leave[k] ?? 0), rate: pay.baseRate, baseRate: true,
    })),
    { code: 'OT', label: `OT Paid ${pay.otMultiplier}X`, hours: hrs(t.ot), rate: pay.baseRate * pay.otMultiplier, baseRate: false },
    { code: 'SHIFT', label: 'Shift Premium', hours: hrs(t.evening), rate: pay.eveningPremium, baseRate: false },
    { code: 'NIGHT', label: 'Night Shift Differential', hours: hrs(t.night), rate: pay.nightPremium, baseRate: false },
    { code: 'WKND', label: 'Weekend Premium', hours: hrs(t.weekend), rate: pay.weekendPremium, baseRate: false },
    { code: 'STATP', label: `Stat Wrkd ${pay.statPremium} Prem`, hours: hrs(t.statPremium), rate: pay.baseRate * pay.statPremium, baseRate: false },
    { code: 'STATP2', label: `Stat Wrkd ${pay.statPremiumDouble} Prem`, hours: hrs(t.statPremiumDouble), rate: pay.baseRate * pay.statPremiumDouble, baseRate: false },
  ]
  return { lines, reimbursementCents: 0 }
}
