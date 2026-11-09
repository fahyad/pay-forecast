// Runs every pay period in order, carrying year-to-date CPP / CPP2 / EI per tax year.
import { toCents } from './money'
import { computePeriodPay } from './payroll'
import { periodForDate, periodInput } from './schedule'
import type { PayPeriod, PeriodPay, Settings, Shift, TaxYear, Ytd } from './types'

export interface PeriodResult {
  period: PayPeriod
  taxYear: number
  /** Tax-year values not yet confirmed against CRA's published figures. */
  estimate: boolean
  shifts: Shift[]
  pay: PeriodPay | null
  /** Why `pay` could not be calculated. */
  error?: string
}

export interface Forecast {
  periods: PeriodResult[]
  /** Shifts whose date is not inside any pay period. */
  unassigned: Shift[]
}

export const taxYearOf = (payDate: string) => Number(payDate.slice(0, 4))

export function computeForecast(settings: Settings, shifts: Shift[]): Forecast {
  const periods = [...settings.periods].sort((a, b) => a.payDate.localeCompare(b.payDate))
  const ytdByYear = new Map<number, Ytd>()
  const o = settings.opening
  ytdByYear.set(o.year, {
    cpp: toCents(o.cpp),
    cpp2: toCents(o.cpp2),
    ei: toCents(o.ei),
    pensionableEarnings: toCents(o.pensionableEarnings),
  })

  const results: PeriodResult[] = periods.map((period) => {
    const year = taxYearOf(period.payDate)
    const periodShifts = shifts
      .filter((s) => s.date >= period.start && s.date <= period.end)
      .sort((a, b) => a.date.localeCompare(b.date))
    const ty: TaxYear | undefined = settings.taxYears.find((t) => t.year === year)
    if (!ty) {
      return { period, taxYear: year, estimate: true, shifts: periodShifts, pay: null, error: `No ${year} tax-year rates in Setup` }
    }
    const before = ytdByYear.get(year) ?? { cpp: 0, cpp2: 0, ei: 0, pensionableEarnings: 0 }
    const input = periodInput(periodShifts, settings.pay, settings.stats)
    const pay = computePeriodPay(input, period.benefitPay, settings.deductions, ty, before)
    ytdByYear.set(year, pay.ytd)
    return { period, taxYear: year, estimate: !ty.confirmed, shifts: periodShifts, pay }
  })

  const unassigned = shifts.filter((s) => !periodForDate(s.date, periods))
  return { periods: results, unassigned }
}

export interface ShiftNetImpact {
  /** Change in total net pay across the forecast from having this shift, in cents. */
  total: number
  /** The part that lands on the shift's own pay date. */
  ownPay: number
  /** The rest: later pays changed by year-to-date effects (e.g. CPP/EI maxing out sooner). */
  later: number
  payDate: string
  /** The shift's pay uses tax-year values not yet confirmed. */
  estimate: boolean
}

/**
 * What one shift adds to take-home pay: the forecast with the shift minus the forecast without it.
 * Unlike splitting a pay's net by share of gross, this reflects the tax deducted at the margin,
 * whether CPP/EI are still being deducted, and leaves out per-pay fixed costs (benefits, levy).
 * Exception: if this is the only paid shift in its period, those fixed costs count against it,
 * because a period with no pay has no deductions at all.
 */
export function shiftNetImpact(settings: Settings, shifts: Shift[], shiftId: string): ShiftNetImpact | null {
  const shift = shifts.find((s) => s.id === shiftId)
  const period = shift && periodForDate(shift.date, settings.periods)
  if (!shift || !period) return null
  const withIt = computeForecast(settings, shifts).periods
  const without = computeForecast(settings, shifts.filter((s) => s.id !== shiftId)).periods
  const own = withIt.find((p) => p.period.id === period.id)
  if (!own?.pay) return null
  // Pays that cannot be calculated (no tax-year rates) contribute nothing either way.
  const diff = withIt.map((p, i) => ({ id: p.period.id, cents: (p.pay?.net ?? 0) - (without[i].pay?.net ?? 0) }))
  const total = diff.reduce((t, d) => t + d.cents, 0)
  const ownPay = diff.find((d) => d.id === period.id)?.cents ?? 0
  return { total, ownPay, later: total - ownPay, payDate: period.payDate, estimate: own.estimate }
}
