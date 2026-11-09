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
