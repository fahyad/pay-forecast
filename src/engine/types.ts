// Data model for the pay forecast. All dates are ISO strings (YYYY-MM-DD); money inputs are dollars.

export type WorkedShiftType = 'day' | 'evening' | 'night'
export type LeaveShiftType =
  | 'sick'
  | 'statHoliday'
  | 'vacation'
  | 'orientation'
  | 'personalLeave'
  | 'floaterStat'
export type ShiftType = WorkedShiftType | LeaveShiftType | 'unpaid'

export interface Shift {
  id: string
  date: string
  type: ShiftType
  hours: number
  /** Overtime: paid at the OT multiplier instead of the base rate; not pensionable. */
  ot: boolean
}

export interface PayRules {
  baseRate: number
  eveningPremium: number
  nightPremium: number
  weekendPremium: number
  otMultiplier: number
  /** Premium on top of 1x base for hours worked on a stat (e.g. 0.5). */
  statPremium: number
  /** Premium for stats marked double (e.g. 1.0 for Christmas = 2.0x total). */
  statPremiumDouble: number
  /** Evening-premium hours earned by a day shift. */
  eveningHoursPerDayShift: number
  /** Weekend-premium hours earned by a Friday day shift. */
  fridayDayWeekendHours: number
  /** Hours of a night shift that fall before midnight. */
  nightHoursBeforeMidnight: number
  defaultShiftHours: number
}

export interface NamedAmount {
  name: string
  amount: number
}

export interface DeductionRules {
  unionDuesRate: number
  unionLevy: number
  /** LAPP rate on base-rate pay up to YMPE / pays per year. */
  lappRateLow: number
  /** LAPP rate on base-rate pay above YMPE / pays per year. */
  lappRateHigh: number
  tfsaEmployeeRate: number
  tfsaEmployerRate: number
  /** Employee premiums deducted after tax on benefit pays. */
  benefitPremiums: NamedAmount[]
  /** Employer-paid non-cash benefits added to taxable income on benefit pays. */
  employerTaxableBenefits: NamedAmount[]
}

export interface Bracket {
  over: number
  rate: number
}

/** Statutory values for one tax year (CRA T4127). The tax year of a pay is decided by its pay date. */
export interface TaxYear {
  year: number
  payPeriods: number
  cppRate: number
  cppBaseRate: number
  cppExemption: number
  ympe: number
  yampe: number
  cpp2Rate: number
  eiRate: number
  eiMaxInsurable: number
  federalBrackets: Bracket[]
  albertaBrackets: Bracket[]
  federalCreditRate: number
  albertaCreditRate: number
  /** TD1 total claim amount (TC). */
  federalClaim: number
  /** TD1AB total claim amount (TCP). */
  albertaClaim: number
  canadaEmploymentAmount: number
  /** False until every value has been checked against CRA's published figures. */
  confirmed: boolean
}

export interface PayPeriod {
  id: string
  start: string
  end: string
  payDate: string
  benefitPay: boolean
}

export interface StatHoliday {
  date: string
  /** Pays statPremiumDouble instead of statPremium. */
  double: boolean
}

/** Year-to-date totals at the start of the first forecast period. */
export interface OpeningYtd {
  year: number
  cpp: number
  cpp2: number
  ei: number
  pensionableEarnings: number
}

export interface Settings {
  pay: PayRules
  deductions: DeductionRules
  taxYears: TaxYear[]
  periods: PayPeriod[]
  stats: StatHoliday[]
  opening: OpeningYtd
}

/** One earnings line, like a pay stub row. */
export interface EarningsLine {
  code: string
  label: string
  hours: number
  /** Dollars per hour. */
  rate: number
  /** True when the line is base-rate pay (pensionable for LAPP, counts for TFSA). */
  baseRate: boolean
}

/** Everything that determines one period's pay, independent of how it was entered. */
export interface PeriodInput {
  lines: EarningsLine[]
  /** Non-taxable, non-pensionable one-off amounts (e.g. membership reimbursement), in cents. */
  reimbursementCents: number
}

export interface Ytd {
  cpp: number
  cpp2: number
  ei: number
  pensionableEarnings: number
}

/** All money in cents. */
export interface PeriodPay {
  earnings: { code: string; label: string; hours: number; rate: number; cents: number }[]
  reimbursement: number
  gross: number
  basePay: number
  unionDues: number
  lapp: number
  tfsaEmployer: number
  employerNonCash: number
  taxableIncome: number
  incomeTax: number
  cpp: number
  cpp2: number
  ei: number
  tfsaEmployee: number
  benefitPremiums: number
  net: number
  ytd: Ytd
}
