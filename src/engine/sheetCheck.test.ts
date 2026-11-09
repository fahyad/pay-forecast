// Private check: the app's forecast against the corrected Google Sheet, using the user's import file.
// Both files are personal data in the git-ignored private/ folder; the test is skipped when absent.
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { computeForecast } from './forecast'
import type { Settings, Shift } from './types'

const IMPORT = new URL('../../private/import.private.json', import.meta.url)
const SHEET = new URL('../../private/sheet-expected.private.json', import.meta.url)
const ready = existsSync(IMPORT) && existsSync(SHEET)
const data: { settings: Settings; shifts: Shift[] } | null = ready ? JSON.parse(readFileSync(IMPORT, 'utf8')) : null
const sheet: { periods: Record<string, { hours: number[]; gross: number; net: number }> } | null = ready
  ? JSON.parse(readFileSync(SHEET, 'utf8'))
  : null

describe.skipIf(!ready)('private sheet check', () => {
  const forecast = data ? computeForecast(data.settings, data.shifts) : null
  const hoursOf = (codes: string[], id: string) => {
    const pay = forecast!.periods.find((p) => p.period.id === id)!.pay!
    return Math.round(pay.earnings.filter((e) => codes.includes(e.code)).reduce((s, e) => s + e.hours, 0) * 100) / 100
  }

  it('assigns every shift to a pay period', () => {
    expect(forecast!.unassigned).toEqual([])
  })

  for (const [id, exp] of Object.entries(sheet?.periods ?? {})) {
    it(`${id}: hours by type match the sheet`, () => {
      const base = ['REG', 'STAT1X', 'SICK', 'STATHOL', 'VAC', 'ORIENT', 'PERS', 'FLOAT']
      const got = [hoursOf(base, id), hoursOf(['SHIFT'], id), hoursOf(['NIGHT'], id), hoursOf(['WKND'], id),
        hoursOf(['STATP', 'STATP2'], id), hoursOf(['OT'], id)]
      expect(got).toEqual(exp.hours)
    })
  }

  it('prints the app vs sheet comparison', () => {
    const rows = forecast!.periods.map((p) => {
      const exp = sheet!.periods[p.period.id]
      const pay = p.pay!
      return {
        period: p.period.id, payDate: p.period.payDate,
        gross: pay.gross / 100, sheetGross: exp?.gross, net: pay.net / 100, sheetNet: exp?.net,
        diff: exp ? Math.round((pay.net / 100 - exp.net) * 100) / 100 : null,
        cpp: pay.cpp / 100, cpp2: pay.cpp2 / 100, ei: pay.ei / 100, tax: pay.incomeTax / 100, estimate: p.estimate,
      }
    })
    console.table(rows)
  })
})
