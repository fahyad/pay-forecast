const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })

/** Cents to "$1,234.56". */
export const fmtCents = (cents: number): string => money.format(cents / 100)

export const fmtHours = (hours: number): string => hours.toFixed(2)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "2026-11-25" -> "Nov 25, 2026". */
export function fmtDate(iso: string, withYear = true): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ''}`
}

/** "2026-11-25" -> "Wed Nov 25". */
export function fmtDayDate(iso: string): string {
  const day = DAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()]
  return `${day} ${fmtDate(iso, false)}`
}

export const todayIso = (): string => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export const SHIFT_TYPE_LABELS: Record<string, string> = {
  day: 'Day',
  evening: 'Evening',
  night: 'Night',
  sick: 'Sick',
  statHoliday: 'Stat holiday (not worked)',
  vacation: 'Vacation',
  orientation: 'Orientation',
  personalLeave: 'Personal leave',
  floaterStat: 'Floater stat',
  unpaid: 'Unpaid',
}
