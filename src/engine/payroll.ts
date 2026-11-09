// One pay period: earnings lines -> deductions -> net pay, all in integer cents.
import { lineCents, percentOf, roundDiv, toCents, toMicros } from './money'
import { cpp2Max, cppMax, eiMax, incomeTaxCents } from './tax'
import type { DeductionRules, PeriodInput, PeriodPay, TaxYear, Ytd } from './types'

const sumAmounts = (items: { amount: number }[]) => items.reduce((s, i) => s + toCents(i.amount), 0)

export function computePeriodPay(
  input: PeriodInput,
  benefitPay: boolean,
  ded: DeductionRules,
  ty: TaxYear,
  ytdBefore: Ytd,
): PeriodPay {
  const P = ty.payPeriods
  const paidLines = input.lines
    .filter((l) => l.hours !== 0)
    .map((l) => ({ ...l, cents: lineCents(l.hours, l.rate) }))
  const earnings = paidLines.map(({ code, label, hours, rate, cents }) => ({ code, label, hours, rate, cents }))
  const reimbursement = input.reimbursementCents
  const earned = paidLines.reduce((s, l) => s + l.cents, 0)
  const gross = earned + reimbursement
  const basePay = paidLines.reduce((s, l) => s + (l.baseRate ? l.cents : 0), 0)

  // Before-tax deductions. Reimbursements are not charged union dues.
  const unionDues = earned === 0 ? 0 : percentOf(earned, ded.unionDuesRate) + toCents(ded.unionLevy)
  // LAPP splits base-rate pay at YMPE / pays per year (not a whole number of cents). Each part is
  // rounded on its own: a real stub matched only that way (rounding the sum was 1 cent high).
  // Truncating the sum also fits every stub checked so far.
  const lappThreshold = (ty.ympe * 100) / P
  const lappLow = Math.round((toMicros(ded.lappRateLow) * Math.min(basePay, lappThreshold)) / 1e6 + 1e-9)
  const lappHigh = Math.round((toMicros(ded.lappRateHigh) * Math.max(0, basePay - lappThreshold)) / 1e6 + 1e-9)
  const lapp = lappLow + lappHigh

  // Taxable benefits.
  const tfsaEmployer = percentOf(basePay, ded.tfsaEmployerRate)
  const employerNonCash = benefitPay && earned > 0 ? sumAmounts(ded.employerTaxableBenefits) : 0

  // CPP / CPP2 / EI (T4127). Pensionable earnings include taxable benefits; EI excludes non-cash ones.
  const pensionable = earned + tfsaEmployer + employerNonCash
  const insurable = earned + tfsaEmployer
  const exemptionPerPay = (ty.cppExemption * 100) / P
  const cppRoom = toCents(cppMax(ty)) - ytdBefore.cpp
  const cpp = Math.max(0, Math.min(cppRoom, Math.round(((pensionable - exemptionPerPay) * toMicros(ty.cppRate)) / 1e6 + 1e-9)))
  const cpp2Room = toCents(cpp2Max(ty)) - ytdBefore.cpp2
  const w = Math.max(ytdBefore.pensionableEarnings, toCents(ty.ympe))
  const cpp2Base = Math.max(0, ytdBefore.pensionableEarnings + pensionable - w)
  const cpp2 = Math.max(0, Math.min(cpp2Room, roundDiv(cpp2Base * toMicros(ty.cpp2Rate), 1e6)))
  const eiRoom = toCents(eiMax(ty)) - ytdBefore.ei
  const ei = Math.max(0, Math.min(eiRoom, percentOf(insurable, ty.eiRate)))

  const ytd: Ytd = {
    cpp: ytdBefore.cpp + cpp,
    cpp2: ytdBefore.cpp2 + cpp2,
    ei: ytdBefore.ei + ei,
    pensionableEarnings: ytdBefore.pensionableEarnings + pensionable,
  }

  // Income tax.
  const taxableIncome = earned + tfsaEmployer + employerNonCash - unionDues - lapp
  const incomeTax =
    taxableIncome <= 0
      ? 0
      : incomeTaxCents(
          {
            taxableIncome: taxableIncome / 100,
            cpp: cpp / 100,
            cpp2: cpp2 / 100,
            ei: ei / 100,
            cppMaxed: ytd.cpp >= toCents(cppMax(ty)),
            eiMaxed: ytd.ei >= toCents(eiMax(ty)),
          },
          ty,
        )

  // After-tax deductions.
  const tfsaEmployee = percentOf(basePay, ded.tfsaEmployeeRate)
  const benefitPremiums = benefitPay && earned > 0 ? sumAmounts(ded.benefitPremiums) : 0

  const net = gross - unionDues - lapp - incomeTax - cpp - cpp2 - ei - tfsaEmployee - benefitPremiums

  return {
    earnings,
    reimbursement,
    gross,
    basePay,
    unionDues,
    lapp,
    tfsaEmployer,
    employerNonCash,
    taxableIncome,
    incomeTax,
    cpp,
    cpp2,
    ei,
    tfsaEmployee,
    benefitPremiums,
    net,
    ytd,
  }
}
