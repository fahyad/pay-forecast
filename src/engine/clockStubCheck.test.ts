// Private check: premium hours worked out from shift clock times must match real pay stubs.
// Reads the git-ignored stub fixture; skipped when absent.
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './defaults'
import { periodInput } from './schedule'
import type { Shift, StatHoliday } from './types'

const FIXTURE = new URL('../../private/stubs.private.json', import.meta.url)
const IMPORT = new URL('../../private/import.private.json', import.meta.url)
const fixture: { timed?: { payDate: string; shifts: Omit<Shift, 'id'>[]; expectedHours: Record<string, number> }[] } | null =
  existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : null
const stats: StatHoliday[] = existsSync(IMPORT) ? JSON.parse(readFileSync(IMPORT, 'utf8')).settings.stats : []

describe.skipIf(!fixture?.timed)('private stub check: premiums from clock times', () => {
  for (const c of fixture?.timed ?? []) {
    it(`${c.payDate}: evening, night, weekend and stat hours match the stub`, () => {
      const shifts = c.shifts.map((s, i) => ({ ...s, id: String(i) }))
      const lines = periodInput(shifts, { ...DEFAULT_SETTINGS.pay, baseRate: 1 }, stats).lines
      for (const [code, hours] of Object.entries(c.expectedHours)) {
        expect(lines.find((l) => l.code === code)?.hours, code).toBeCloseTo(hours, 2)
      }
    })
  }
})
