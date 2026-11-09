// Public defaults only. Statutory values are from CRA (T4127, CPP/EI pages); personal values
// (pay rate, premiums, deductions, TD1 claims) are left neutral and come from the user's import file.
import type { Settings, TaxYear } from './types'

export const TAX_YEAR_2026: TaxYear = {
  year: 2026,
  payPeriods: 26,
  cppRate: 0.0595,
  cppBaseRate: 0.0495,
  cppExemption: 3500,
  ympe: 74600,
  yampe: 85000,
  cpp2Rate: 0.04,
  eiRate: 0.0163,
  eiMaxInsurable: 68900,
  federalBrackets: [
    { over: 0, rate: 0.14 },
    { over: 58523, rate: 0.205 },
    { over: 117045, rate: 0.26 },
    { over: 181440, rate: 0.29 },
    { over: 258482, rate: 0.33 },
  ],
  albertaBrackets: [
    { over: 0, rate: 0.08 },
    { over: 61200, rate: 0.1 },
    { over: 154259, rate: 0.12 },
    { over: 185111, rate: 0.13 },
    { over: 246813, rate: 0.14 },
    { over: 370220, rate: 0.15 },
  ],
  federalCreditRate: 0.14,
  albertaCreditRate: 0.08,
  federalClaim: 16452,
  albertaClaim: 22769,
  canadaEmploymentAmount: 1501,
  confirmed: true,
}

/**
 * 2027: YMPE/YAMPE and EI are published by CRA. CPP rate and maximums, federal/Alberta brackets,
 * personal amounts and the Canada employment amount are not yet published, so 2026 values stand in
 * and the year stays unconfirmed (pays in it show as Estimate).
 */
export const TAX_YEAR_2027: TaxYear = {
  ...TAX_YEAR_2026,
  year: 2027,
  ympe: 76700,
  yampe: 87400,
  eiRate: 0.0164,
  eiMaxInsurable: 70800,
  confirmed: false,
}

export const DEFAULT_SETTINGS: Settings = {
  pay: {
    baseRate: 0,
    eveningPremium: 0,
    nightPremium: 0,
    weekendPremium: 0,
    otMultiplier: 2,
    statPremium: 0.5,
    statPremiumDouble: 1,
    eveningHoursPerDayShift: 0,
    fridayDayWeekendHours: 0,
    nightHoursBeforeMidnight: 0,
    defaultShiftHours: 12,
  },
  deductions: {
    unionDuesRate: 0,
    unionLevy: 0,
    lappRateLow: 0,
    lappRateHigh: 0,
    tfsaEmployeeRate: 0,
    tfsaEmployerRate: 0,
    benefitPremiums: [],
    employerTaxableBenefits: [],
  },
  taxYears: [TAX_YEAR_2026, TAX_YEAR_2027],
  periods: [],
  stats: [],
  opening: { year: 2026, cpp: 0, cpp2: 0, ei: 0, pensionableEarnings: 0 },
}
