// Dashboard summary for a selection of pay cycles: net pay, regular / overtime / leave counts,
// what regular and overtime shifts add to net pay, and one heatmap cell per day of each cycle.
import { computeForecast } from './forecast'
import { addDays } from './schedule'
import type { LeaveShiftType, PayPeriod, Settings, Shift } from './types'

export type DayKind = 'off' | 'regular' | 'overtime' | 'leave'

export interface DayCell {
  date: string
  kind: DayKind
  shifts: Shift[]
}

export interface CycleSummary {
  period: PayPeriod
  /** Net pay in cents (null when the pay cannot be calculated, e.g. no tax-year rates). */
  net: number | null
  estimate: boolean
  regular: number
  overtime: number
  leave: Partial<Record<LeaveShiftType, number>>
  days: DayCell[]
}

export interface DashboardSummary {
  cycles: CycleSummary[]
  /** Sum of the selected cycles' net pay, cents. */
  net: number
  regular: number
  overtime: number
  /** What the selected cycles' regular / overtime shifts add to net pay, cents. */
  regularAdds: number
  overtimeAdds: number
  daysWorked: number
  leaveDays: number
  estimate: boolean
  /** Selected cycles whose pay could not be calculated. */
  missing: PayPeriod[]
}

const isWorked = (s: Shift) => s.type === 'day' || s.type === 'evening' || s.type === 'night'
const isRegular = (s: Shift) => isWorked(s) && !s.ot
const isOvertime = (s: Shift) => isWorked(s) && s.ot
const isLeave = (s: Shift): s is Shift & { type: LeaveShiftType } => !isWorked(s) && s.type !== 'unpaid'
const inPeriod = (s: Shift, p: PayPeriod) => s.date >= p.start && s.date <= p.end

function dayKind(shifts: Shift[]): DayKind {
  if (shifts.some(isRegular)) return 'regular'
  if (shifts.some(isOvertime)) return 'overtime'
  if (shifts.some((s) => s.type !== 'unpaid')) return 'leave'
  return 'off'
}

/**
 * Net pay across the whole forecast without `removed`, minus with it: what those shifts add.
 * Removing the group at once (not shift by shift) avoids counting tax-bracket effects twice.
 */
function addsToNet(settings: Settings, shifts: Shift[], removed: Set<string>): number {
  if (removed.size === 0) return 0
  const withAll = computeForecast(settings, shifts).periods
  const without = computeForecast(settings, shifts.filter((s) => !removed.has(s.id))).periods
  return withAll.reduce((t, p, i) => t + (p.pay?.net ?? 0) - (without[i].pay?.net ?? 0), 0)
}

export function summarizeDashboard(settings: Settings, shifts: Shift[], selectedIds: string[]): DashboardSummary {
  const forecast = computeForecast(settings, shifts)
  const selected = forecast.periods.filter((r) => selectedIds.includes(r.period.id))

  const cycles: CycleSummary[] = selected.map((r) => {
    const own = shifts.filter((s) => inPeriod(s, r.period))
    const leave: CycleSummary['leave'] = {}
    for (const s of own) if (isLeave(s)) leave[s.type] = (leave[s.type] ?? 0) + 1
    const days: DayCell[] = []
    for (let d = r.period.start; d <= r.period.end; d = addDays(d, 1)) {
      const onDay = own.filter((s) => s.date === d)
      days.push({ date: d, kind: dayKind(onDay), shifts: onDay })
    }
    return {
      period: r.period,
      net: r.pay?.net ?? null,
      estimate: r.estimate,
      regular: own.filter(isRegular).length,
      overtime: own.filter(isOvertime).length,
      leave,
      days,
    }
  })

  const selectedShifts = shifts.filter((s) => selected.some((r) => inPeriod(s, r.period)))
  const allDays = cycles.flatMap((c) => c.days)
  return {
    cycles,
    net: cycles.reduce((t, c) => t + (c.net ?? 0), 0),
    regular: cycles.reduce((t, c) => t + c.regular, 0),
    overtime: cycles.reduce((t, c) => t + c.overtime, 0),
    regularAdds: addsToNet(settings, shifts, new Set(selectedShifts.filter(isRegular).map((s) => s.id))),
    overtimeAdds: addsToNet(settings, shifts, new Set(selectedShifts.filter(isOvertime).map((s) => s.id))),
    daysWorked: allDays.filter((d) => d.kind === 'regular' || d.kind === 'overtime').length,
    leaveDays: allDays.filter((d) => d.kind === 'leave').length,
    estimate: cycles.some((c) => c.estimate),
    missing: cycles.filter((c) => c.net === null).map((c) => c.period),
  }
}

/** The pay to select when nothing is remembered: the next pay on or after today, else the latest. */
export function defaultSelection(periods: PayPeriod[], today: string): string[] {
  const sorted = [...periods].sort((a, b) => a.payDate.localeCompare(b.payDate))
  const next = sorted.find((p) => p.payDate >= today) ?? sorted.at(-1)
  return next ? [next.id] : []
}
