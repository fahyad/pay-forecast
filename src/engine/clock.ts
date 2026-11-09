// Premium hours from clock times, following the UNA-AHS collective agreement (Article 28):
//  - Regular shift: a premium applies to the whole shift when the majority of the shift falls in its
//    window; otherwise to each hour in the window, provided more than one hour falls there. A shift
//    ending between 15:00 and 17:00 gets no evening premium (and, on a Friday, no weekend premium).
//  - Overtime: each overtime hour that falls in the window.
//  - Stat: the hours that fall on the stat date.
// Unpaid breaks are not modelled; window hours are capped at the paid hours.
import { addDays, weekday } from './schedule'
import type { PayRules, StatHoliday, TimeWindow } from './types'

const DAY = 1440

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** [start, end) in minutes from the shift date's midnight; end > start (crosses midnight if needed). */
export function clockSpan(start: string, end: string): [number, number] {
  const s = toMinutes(start)
  let e = toMinutes(end)
  if (e <= s) e += DAY
  return [s, e]
}

export const clockHours = (start: string, end: string): number => {
  const [s, e] = clockSpan(start, end)
  return (e - s) / 60
}

const overlap = (a1: number, a2: number, b1: number, b2: number) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1))

/** Minutes of [s, e) inside a window that repeats daily. */
export function inDailyWindow(s: number, e: number, w: TimeWindow): number {
  const ws = toMinutes(w.start)
  let we = toMinutes(w.end)
  if (we <= ws) we += DAY
  let t = 0
  for (let d = -1; d <= 2; d++) t += overlap(s, e, d * DAY + ws, d * DAY + we)
  return t
}

/** Minutes of [s, e) inside the weekend window (Friday `weekendStart` for `weekendHours`). */
export function inWeekend(date: string, s: number, e: number, pay: PayRules): number {
  let t = 0
  for (let d = -7; d <= 1; d++) {
    if (weekday(addDays(date, d)) !== 5) continue
    const a = d * DAY + toMinutes(pay.weekendStart)
    t += overlap(s, e, a, a + pay.weekendHours * 60)
  }
  return t
}

/** Paid hours suggested for a shift: overtime pays every clock hour; a 12-hour regular shift pays `twelveHourPaid`. */
export function suggestedPaidHours(start: string, end: string, ot: boolean, pay: PayRules): number {
  const h = clockHours(start, end)
  return !ot && h === 12 ? pay.twelveHourPaid : Math.round(h * 100) / 100
}

/** Which kind of shift the times describe (where most of the hours fall). */
export function kindFromTimes(start: string, end: string, pay: PayRules): 'day' | 'evening' | 'night' {
  const [s, e] = clockSpan(start, end)
  if (inDailyWindow(s, e, pay.nightWindow) * 2 > e - s) return 'night'
  if (inDailyWindow(s, e, pay.eveningWindow) * 2 > e - s) return 'evening'
  return 'day'
}

export interface ClockPremiums {
  /** All in hundredths of an hour, capped at the paid hours. */
  evening: number
  night: number
  weekend: number
  stats: { date: string; double: boolean; hours: number }[]
}

const endsBetween15And17 = (e: number) => {
  const t = e % DAY
  return t >= 15 * 60 && t <= 17 * 60
}

export function clockPremiums(
  date: string,
  start: string,
  end: string,
  ot: boolean,
  paidHundredths: number,
  pay: PayRules,
  stats: StatHoliday[],
): ClockPremiums {
  const [s, e] = clockSpan(start, end)
  const total = e - s
  const toH = (minutes: number) => Math.round((minutes * 100) / 60)
  const cap = (hundredths: number) => Math.min(hundredths, paidHundredths)

  let eve = inDailyWindow(s, e, pay.eveningWindow)
  let night = inDailyWindow(s, e, pay.nightWindow)
  let wknd = inWeekend(date, s, e, pay)
  let evening: number, nightH: number, weekend: number

  if (ot) {
    evening = cap(toH(eve))
    nightH = cap(toH(night))
    weekend = cap(toH(wknd))
  } else {
    if (night * 2 > total) {
      nightH = paidHundredths
      evening = 0
    } else if (eve * 2 > total) {
      evening = paidHundredths
      nightH = 0
    } else {
      evening = eve > 60 && !endsBetween15And17(e) ? cap(toH(eve)) : 0
      nightH = night > 60 ? cap(toH(night)) : 0
    }
    if (wknd * 2 > total) weekend = paidHundredths
    else weekend = wknd > 60 && !(weekday(date) === 5 && endsBetween15And17(e)) ? cap(toH(wknd)) : 0
  }

  const statList: ClockPremiums['stats'] = []
  let statLeft = paidHundredths
  for (let d = 0; d <= 1; d++) {
    const day = addDays(date, d)
    const stat = stats.find((x) => x.date === day)
    if (!stat) continue
    const h = Math.min(toH(overlap(s, e, d * DAY, (d + 1) * DAY)), statLeft)
    if (h > 0) {
      statList.push({ date: day, double: stat.double, hours: h })
      statLeft -= h
    }
  }
  return { evening, night: nightH, weekend, stats: statList }
}
