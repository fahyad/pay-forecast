// Public tests: fictional rates, expected values worked independently of this code.
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, TAX_YEAR_2026 } from './defaults'
import { computeForecast } from './forecast'
import { lineCents, percentOf, roundDollarsToCents } from './money'
import { computePeriodPay } from './payroll'
import { periodInput, shiftHours } from './schedule'
import { incomeTaxCents } from './tax'
import type { DeductionRules, PayRules, Settings, Shift, StatHoliday } from './types'

const pay: PayRules = {
  baseRate: 40,
  eveningPremium: 2,
  nightPremium: 4,
  weekendPremium: 3,
  otMultiplier: 2,
  statPremium: 0.5,
  statPremiumDouble: 1,
  eveningHoursPerDayShift: 4.25,
  fridayDayWeekendHours: 4.25,
  nightHoursBeforeMidnight: 5,
  defaultShiftHours: 12,
}
const shift = (date: string, type: Shift['type'], hours = 12, ot = false): Shift => ({ id: date + type, date, type, hours, ot })

describe('money rounding', () => {
  it('rounds each line half-up to the cent without float drift', () => {
    expect(lineCents(5, 20.005)).toBe(10003) // 100.025 -> 100.03
    expect(lineCents(8.5, 2.75)).toBe(2338) // 23.375 -> 23.38
    expect(lineCents(11.63, 41.25)).toBe(47974) // 479.7375 -> 479.74
    expect(percentOf(300000, 0.0163)).toBe(4890)
    expect(roundDollarsToCents(1.005)).toBe(101)
  })
})

describe('shift hours', () => {
  const stats: StatHoliday[] = [
    { date: '2026-10-12', double: false },
    { date: '2026-12-25', double: true },
  ]
  // 2026-10-12 is a Monday, 2026-10-16 a Friday, 2026-10-17 a Saturday.

  it('day shift: evening premium capped, no night, weekday', () => {
    const h = shiftHours(shift('2026-10-14', 'day'), pay, [])
    expect(h).toMatchObject({ regular: 1200, evening: 425, night: 0, weekend: 0, statPremium: 0 })
  })

  it('night shift starting on a stat: only the hours before midnight are stat hours', () => {
    const h = shiftHours(shift('2026-10-12', 'night', 11.63), pay, stats)
    expect(h).toMatchObject({ statWorked: 500, regular: 663, statPremium: 500, night: 1163 })
  })

  it('night shift starting the evening before a stat: the hours after midnight are stat hours', () => {
    const h = shiftHours(shift('2026-10-11', 'night', 12), pay, stats)
    expect(h).toMatchObject({ statWorked: 700, regular: 500, statPremium: 700 })
  })

  it('day shift on a double stat uses the double premium', () => {
    const h = shiftHours(shift('2026-12-25', 'day', 12), pay, stats)
    expect(h).toMatchObject({ statWorked: 1200, statPremiumDouble: 1200, statPremium: 0 })
  })

  it('weekend: Friday day partial, Friday night full, Saturday full, Friday evening none', () => {
    expect(shiftHours(shift('2026-10-16', 'day'), pay, []).weekend).toBe(425)
    expect(shiftHours(shift('2026-10-16', 'night'), pay, []).weekend).toBe(1200)
    expect(shiftHours(shift('2026-10-17', 'day'), pay, []).weekend).toBe(1200)
    expect(shiftHours(shift('2026-10-16', 'evening'), pay, []).weekend).toBe(0)
  })

  it('OT shift: no base hours, still earns premiums and stat premium', () => {
    const h = shiftHours(shift('2026-10-12', 'day', 8, true), pay, stats)
    expect(h).toMatchObject({ regular: 0, ot: 800, evening: 425, statPremium: 800, statWorked: 0 })
  })

  it('leave is base-rate pay with no premiums; unpaid earns nothing', () => {
    expect(shiftHours(shift('2026-10-17', 'sick', 11.63), pay, stats)).toMatchObject({ leave: { sick: 1163 }, weekend: 0 })
    expect(shiftHours(shift('2026-10-17', 'unpaid'), pay, stats)).toMatchObject({ regular: 0, leave: {} })
  })

  it('period lines use payroll rates (OT at 2x, stat premiums at base x multiplier)', () => {
    const input = periodInput([shift('2026-12-25', 'day', 12), shift('2026-10-14', 'day', 8, true)], pay, stats)
    const byCode = Object.fromEntries(input.lines.map((l) => [l.code, l]))
    expect(byCode.OT).toMatchObject({ hours: 8, rate: 80, baseRate: false })
    expect(byCode.STAT1X).toMatchObject({ hours: 12, rate: 40, baseRate: true })
    expect(byCode.STATP2).toMatchObject({ hours: 12, rate: 40 })
  })
})

describe('income tax (CRA T4127, 2026)', () => {
  it('CPP and EI maxed: full annual credits', () => {
    expect(
      incomeTaxCents({ taxableIncome: 2000, cpp: 0, cpp2: 0, ei: 0, cppMaxed: true, eiMaxed: true }, TAX_YEAR_2026),
    ).toBe(23399)
  })
  it('CPP and EI still deducted: credits from this pay, annualised and capped', () => {
    expect(
      incomeTaxCents({ taxableIncome: 3000, cpp: 150, cpp2: 0, ei: 48.9, cppMaxed: false, eiMaxed: false }, TAX_YEAR_2026),
    ).toBe(51024)
  })
})

const ded: DeductionRules = {
  unionDuesRate: 0.01,
  unionLevy: 2,
  lappRateLow: 0.05,
  lappRateHigh: 0.08,
  tfsaEmployeeRate: 0.03,
  tfsaEmployerRate: 0.01,
  benefitPremiums: [{ name: 'Plan', amount: 10 }],
  employerTaxableBenefits: [{ name: 'Life', amount: 1 }],
}
const lines = {
  lines: [
    { code: 'REG', label: 'Regular Pay', hours: 80, rate: 40, baseRate: true },
    { code: 'SHIFT', label: 'Shift Premium', hours: 10, rate: 2, baseRate: false },
  ],
  reimbursementCents: 0,
}

describe('one pay period', () => {
  it('fresh year: CPP with exemption, EI, LAPP split rounded per part, net', () => {
    const p = computePeriodPay(lines, true, ded, TAX_YEAR_2026, { cpp: 0, cpp2: 0, ei: 0, pensionableEarnings: 0 })
    expect(p).toMatchObject({
      gross: 322000, basePay: 320000, unionDues: 3420, lapp: 16992, tfsaEmployer: 3200, employerNonCash: 100,
      taxableIncome: 304888, cpp: 18554, cpp2: 0, ei: 5301, incomeTax: 52100, tfsaEmployee: 9600, benefitPremiums: 1000,
      net: 215033,
    })
  })

  it('CPP maxes, CPP2 starts above the YMPE and EI maxes within the same pay', () => {
    const p = computePeriodPay(lines, true, ded, TAX_YEAR_2026, {
      cpp: 410000, cpp2: 0, ei: 110000, pensionableEarnings: 7300000,
    })
    expect(p).toMatchObject({ cpp: 13045, cpp2: 6612, ei: 2307, incomeTax: 50366, net: 218658 })
    expect(p.ytd).toMatchObject({ cpp: 423045, ei: 112307 })
  })

  it('non-benefit pay and an empty period deduct nothing extra', () => {
    const none = computePeriodPay({ lines: [], reimbursementCents: 0 }, true, ded, TAX_YEAR_2026, {
      cpp: 0, cpp2: 0, ei: 0, pensionableEarnings: 0,
    })
    expect(none).toMatchObject({ gross: 0, unionDues: 0, benefitPremiums: 0, employerNonCash: 0, net: 0 })
  })
})

describe('forecast', () => {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    pay,
    deductions: ded,
    periods: [
      { id: 'A', start: '2026-12-07', end: '2026-12-20', payDate: '2026-12-30', benefitPay: false },
      { id: 'B', start: '2026-12-21', end: '2027-01-03', payDate: '2027-01-13', benefitPay: true },
    ],
    opening: { year: 2026, cpp: 4230.45, cpp2: 416, ei: 1123.07, pensionableEarnings: 90000 },
  }
  const shifts = [shift('2026-12-08', 'day'), shift('2026-12-22', 'day'), shift('2027-03-01', 'day')]

  it('opening YTD applies to its year; a new tax year starts from zero and is an estimate', () => {
    const f = computeForecast(settings, shifts)
    const [a, b] = f.periods
    expect(a.pay).toMatchObject({ cpp: 0, cpp2: 0, ei: 0 })
    expect(a.estimate).toBe(false)
    expect(b.taxYear).toBe(2027)
    expect(b.estimate).toBe(true)
    expect(b.pay!.cpp).toBeGreaterThan(0)
    expect(b.pay!.ei).toBeGreaterThan(0)
  })

  it('flags shifts outside every pay period and years with no rates', () => {
    const f = computeForecast({ ...settings, taxYears: [TAX_YEAR_2026] }, shifts)
    expect(f.unassigned.map((s) => s.date)).toEqual(['2027-03-01'])
    expect(f.periods[1].pay).toBeNull()
    expect(f.periods[1].error).toMatch(/2027/)
  })
})
