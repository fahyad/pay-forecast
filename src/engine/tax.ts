// Income tax per pay, following CRA's payroll deductions formulas (T4127) for Alberta employees.
import { roundDollarsToCents } from './money'
import type { Bracket, TaxYear } from './types'

/** Tax on `income` from progressive brackets; equivalent to T4127's R x A - K. */
export function bracketTax(income: number, brackets: Bracket[]): number {
  let tax = 0
  brackets.forEach((b, i) => {
    const next = brackets[i + 1]?.over ?? Infinity
    if (income > b.over) tax += (Math.min(income, next) - b.over) * b.rate
  })
  return tax
}

export const cppMaxBase = (ty: TaxYear) => ty.cppBaseRate * (ty.ympe - ty.cppExemption)
export const cppMax = (ty: TaxYear) => ty.cppRate * (ty.ympe - ty.cppExemption)
export const cpp2Max = (ty: TaxYear) => ty.cpp2Rate * (ty.yampe - ty.ympe)
export const eiMax = (ty: TaxYear) => ty.eiRate * ty.eiMaxInsurable

export interface TaxInput {
  /** Taxable income for the pay after union dues and pension (T4127 I - F - U1), dollars. */
  taxableIncome: number
  /** CPP (base + first additional) deducted this pay, dollars. */
  cpp: number
  /** CPP2 deducted this pay, dollars. */
  cpp2: number
  ei: number
  /** CPP year-to-date maximum reached (including this pay): the full annual credit applies. */
  cppMaxed: boolean
  eiMaxed: boolean
}

/** Income tax for one pay, in cents. */
export function incomeTaxCents(t: TaxInput, ty: TaxYear): number {
  const P = ty.payPeriods
  // F5: CPP enhancement (first additional) and CPP2 are deducted from income before tax.
  const f5 = t.cpp * ((ty.cppRate - ty.cppBaseRate) / ty.cppRate) + t.cpp2
  const A = P * (t.taxableIncome - f5)
  if (A <= 0) return 0

  const maxBase = cppMaxBase(ty)
  const cppCredit = t.cppMaxed ? maxBase : Math.min(P * t.cpp * (ty.cppBaseRate / ty.cppRate), maxBase)
  const eiCredit = t.eiMaxed ? eiMax(ty) : Math.min(P * t.ei, eiMax(ty))

  const K1 = ty.federalCreditRate * ty.federalClaim
  const K2 = ty.federalCreditRate * (cppCredit + eiCredit)
  const K4 = Math.min(ty.federalCreditRate * A, ty.federalCreditRate * ty.canadaEmploymentAmount)
  const T1 = Math.max(0, bracketTax(A, ty.federalBrackets) - K1 - K2 - K4)

  const K1P = ty.albertaCreditRate * ty.albertaClaim
  const K2P = ty.albertaCreditRate * (cppCredit + eiCredit)
  const T2 = Math.max(0, bracketTax(A, ty.albertaBrackets) - K1P - K2P)

  return roundDollarsToCents((T1 + T2) / P)
}
