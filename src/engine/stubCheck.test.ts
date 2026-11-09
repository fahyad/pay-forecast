// Private accuracy check: real pay stubs must be reproduced line by line.
// The fixture holds personal data, lives in the git-ignored private/ folder, and is skipped when absent.
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TAX_YEAR_2026 } from './defaults'
import { toCents } from './money'
import { computePeriodPay } from './payroll'
import type { DeductionRules, EarningsLine, TaxYear } from './types'

interface StubFixture {
  deductions: DeductionRules
  taxYear: Partial<TaxYear>
  stubs: {
    payDate: string
    benefitPay: boolean
    lines: EarningsLine[]
    reimbursement: number
    ytdBefore: { cpp: number; cpp2: number; ei: number; pensionableEarnings: number }
    expected: Record<string, number>
    /** Allowed cents of difference per field, where a known open item exists. */
    tolerance?: Record<string, number>
  }[]
}

const FIXTURE = new URL('../../private/stubs.private.json', import.meta.url)
const fixture: StubFixture | null = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : null

describe.skipIf(!fixture)('private pay stub check', () => {
  const ty: TaxYear = { ...TAX_YEAR_2026, ...fixture?.taxYear }
  for (const stub of fixture?.stubs ?? []) {
    it(`reproduces the ${stub.payDate} stub`, () => {
      const pay = computePeriodPay(
        { lines: stub.lines, reimbursementCents: toCents(stub.reimbursement) },
        stub.benefitPay,
        fixture!.deductions,
        ty,
        {
          cpp: toCents(stub.ytdBefore.cpp),
          cpp2: toCents(stub.ytdBefore.cpp2),
          ei: toCents(stub.ytdBefore.ei),
          pensionableEarnings: toCents(stub.ytdBefore.pensionableEarnings),
        },
      )
      for (const [field, dollars] of Object.entries(stub.expected)) {
        const got = (pay as unknown as Record<string, number>)[field]
        const tol = stub.tolerance?.[field] ?? 0
        expect(Math.abs(got - toCents(dollars)), `${field}: got ${got / 100}, stub ${dollars}`).toBeLessThanOrEqual(tol)
      }
    })
  }
})
