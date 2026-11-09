import { useState } from 'preact/hooks'
import { shiftNetImpact } from '../engine/forecast'
import { lineCents } from '../engine/money'
import { addDays, periodForDate, periodInput, shiftHours } from '../engine/schedule'
import type { Settings, Shift, ShiftType } from '../engine/types'
import { DateField, NumberField, Toggle } from '../components/fields'
import { fmtCents, fmtDate, fmtDayDate, fmtHours, SHIFT_TYPE_LABELS, todayIso } from '../format'
import { newId } from '../store'

interface Props {
  settings: Settings
  shifts: Shift[]
  onChange: (shifts: Shift[]) => void
  /** Month to show first (YYYY-MM); defaults to the current month. */
  initialMonth?: string
  /** Day selected at first (YYYY-MM-DD). */
  initialSelected?: string
}

const WORKED = new Set<ShiftType>(['day', 'evening', 'night'])
const SHORT: Record<ShiftType, string> = {
  day: 'D', evening: 'E', night: 'N', sick: 'Sick', statHoliday: 'Stat', vacation: 'Vac',
  orientation: 'Ori', personalLeave: 'PL', floaterStat: 'Flt', unpaid: 'Off',
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const monthOf = (iso: string) => iso.slice(0, 7)
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}
/** Every date shown in the month grid: from the Sunday on/before the 1st to the Saturday on/after the last day. */
export function gridDates(month: string): string[] {
  const first = `${month}-01`
  const start = addDays(first, -new Date(`${first}T00:00:00Z`).getUTCDay())
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1)
  const end = addDays(last, 6 - new Date(`${last}T00:00:00Z`).getUTCDay())
  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

export function ScheduleTab({ settings, shifts, onChange, initialMonth, initialSelected }: Props) {
  const today = todayIso()
  const [month, setMonth] = useState(initialMonth ?? monthOf(initialSelected ?? today))
  const [selected, setSelected] = useState<string | null>(initialSelected ?? null)
  const [editing, setEditing] = useState<Shift | null>(null)

  const byDate = new Map<string, Shift[]>()
  for (const s of shifts) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s])
  const payDates = new Set(settings.periods.map((p) => p.payDate))
  const statDates = new Map(settings.stats.map((s) => [s.date, s]))
  const unassigned = shifts.filter((s) => !periodForDate(s.date, settings.periods))

  const save = (s: Shift) => {
    onChange(s.id ? shifts.map((x) => (x.id === s.id ? s : x)) : [...shifts, { ...s, id: newId() }])
    setSelected(s.date)
    setMonth(monthOf(s.date))
    setEditing(null)
  }
  const remove = (id: string) => {
    if (!confirm('Delete this shift?')) return
    onChange(shifts.filter((x) => x.id !== id))
    setEditing(null)
  }
  const newShift = (date: string): Shift => ({ id: '', date, type: 'day', hours: settings.pay.defaultShiftHours, ot: false })

  if (editing) {
    return (
      <ShiftForm
        shift={editing}
        settings={settings}
        onSave={save}
        onCancel={() => setEditing(null)}
        onDelete={editing.id ? () => remove(editing.id) : undefined}
      />
    )
  }

  const [y, m] = month.split('-').map(Number)
  const dayShifts = selected ? (byDate.get(selected) ?? []) : []

  return (
    <div class="stack">
      <section class="card calendar">
        <div class="cal-head">
          <button class="icon" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <button class="cal-title" onClick={() => setMonth(monthOf(today))}>{MONTHS[m - 1]} {y}</button>
          <button class="icon" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        </div>
        <div class="cal-grid" role="grid">
          {WEEKDAYS.map((w, i) => <div key={i} class="cal-weekday">{w}</div>)}
          {gridDates(month).map((date) => {
            const list = byDate.get(date) ?? []
            const stat = statDates.get(date)
            const label = [
              fmtDayDate(date),
              ...list.map((s) => `${SHIFT_TYPE_LABELS[s.type]} ${fmtHours(s.hours)} hours${s.ot ? ' overtime' : ''}`),
              stat ? `stat holiday${stat.double ? ' (2.0x)' : ''}` : '',
              payDates.has(date) ? 'payday' : '',
            ].filter(Boolean).join(', ')
            const cls = ['cal-day', monthOf(date) !== month && 'other', date === today && 'today', date === selected && 'selected', stat && 'stat']
              .filter(Boolean).join(' ')
            return (
              <button key={date} class={cls} aria-label={label} onClick={() => setSelected(date)}>
                <span class="cal-num">{Number(date.slice(8))}</span>
                <span class="cal-chips">
                  {list.slice(0, 2).map((s) => (
                    <span key={s.id} class={`chip chip-${WORKED.has(s.type) ? s.type : 'leave'}${s.ot ? ' chip-ot' : ''}`}>{SHORT[s.type]}</span>
                  ))}
                  {list.length > 2 && <span class="chip chip-more">+{list.length - 2}</span>}
                </span>
                {payDates.has(date) && <span class="cal-pay" aria-hidden="true">$</span>}
              </button>
            )
          })}
        </div>
        <p class="cal-legend fine">
          <span class="chip chip-day">D</span> day <span class="chip chip-evening">E</span> evening <span class="chip chip-night">N</span> night{' '}
          <span class="chip chip-ot chip-day">OT</span> overtime · <span class="cal-pay-inline">$</span> payday · <span class="stat-dot" /> stat
        </p>
      </section>

      {selected && (
        <section class="card day-detail">
          <h3>{fmtDayDate(selected)}, {selected.slice(0, 4)}</h3>
          {statDates.has(selected) && <p class="fine">Stat holiday{statDates.get(selected)!.double ? ' — pays 2.0x' : ''}</p>}
          {payDates.has(selected) && <p class="fine">Payday</p>}
          {dayShifts.length === 0 && <p class="fine">No shift scheduled.</p>}
          {dayShifts.map((s) => (
            <ShiftDetail key={s.id} shift={s} shifts={shifts} settings={settings} onEdit={() => setEditing(s)} onDelete={() => remove(s.id)} />
          ))}
          <button class={dayShifts.length ? '' : 'primary'} onClick={() => setEditing(newShift(selected))}>
            + Add {dayShifts.length ? 'another ' : ''}shift on this day
          </button>
        </section>
      )}

      {unassigned.length > 0 && (
        <p class="warn">
          {unassigned.length} shift(s) are outside every pay period and are not counted:{' '}
          {unassigned.map((s) => fmtDate(s.date)).join(', ')}. Add the missing periods in Setup.
        </p>
      )}
    </div>
  )
}

export function ShiftDetail({ shift, shifts, settings, onEdit, onDelete }: {
  shift: Shift
  /** All shifts, needed to work out what this one adds to net pay. */
  shifts: Shift[]
  settings: Settings
  onEdit: () => void
  onDelete: () => void
}) {
  const h = shiftHours(shift, settings.pay, settings.stats)
  const period = periodForDate(shift.date, settings.periods)
  // Approximate: payroll rounds per pay period, so the cents can differ slightly from the stub.
  const gross = periodInput([shift], settings.pay, settings.stats).lines.reduce((t, l) => t + lineCents(l.hours, l.rate), 0)
  const net = shiftNetImpact(settings, shifts, shift.id)
  const leaveHours = Object.values(h.leave).reduce((a, b) => a + (b ?? 0), 0)
  const rows: [string, number][] = [
    [shift.ot ? 'Overtime hours' : 'Base-rate hours', shift.ot ? h.ot : h.regular + h.statWorked + leaveHours],
    ['Evening premium hours', h.evening],
    ['Night differential hours', h.night],
    ['Weekend premium hours', h.weekend],
    ['Stat hours (0.5x premium)', h.statPremium],
    ['Stat hours (2.0x day)', h.statPremiumDouble],
  ]
  return (
    <div class="shift-detail-card">
      <div class="shift-detail-head">
        <span class="shift-detail-type">
          {SHIFT_TYPE_LABELS[shift.type]}{WORKED.has(shift.type) ? ' shift' : ''}
          {shift.ot && <span class="badge badge-ot">Overtime</span>}
        </span>
        <span class="shift-detail-hours">{fmtHours(shift.hours)} paid hours</span>
      </div>
      <table class="lines">
        <tbody>
          {rows.filter(([, v]) => v > 0).map(([label, v]) => (
            <tr key={label}><td>{label}</td><td>{fmtHours(v / 100)}</td></tr>
          ))}
          <tr class="total"><td>Earns (gross, approx.)</td><td>{fmtCents(gross)}</td></tr>
          {net && <tr class="total"><td>Adds to net pay ({net.estimate ? 'estimate' : 'approx.'})</td><td>{fmtCents(net.total)}</td></tr>}
        </tbody>
      </table>
      {net && (
        <p class="fine">
          Net = your take-home with this shift minus without it, using the tax deducted from that pay.
          {Math.abs(net.later) >= 100 &&
            ` ${fmtCents(net.ownPay)} on the ${fmtDate(net.payDate)} pay and ${fmtCents(net.later)} on later pays (CPP/EI timing).`}
          {' '}Tax withheld on a large pay can be more than your actual annual tax; any difference comes back at tax time.
        </p>
      )}
      <p class="fine">
        {period
          ? `Pay period ${fmtDate(period.start, false)} – ${fmtDate(period.end, false)} · paid ${fmtDate(period.payDate)}`
          : 'Not in any pay period — add one in Setup.'}
      </p>
      <div class="row">
        <button onClick={onEdit}>Edit</button>
        <button class="danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

function ShiftForm(p: { shift: Shift; settings: Settings; onSave: (s: Shift) => void; onCancel: () => void; onDelete?: () => void }) {
  const [s, setS] = useState(p.shift)
  const worked = WORKED.has(s.type)
  const period = periodForDate(s.date, p.settings.periods)
  return (
    <section class="card form">
      <h3>{p.shift.id ? 'Edit shift' : 'New shift'}</h3>
      <DateField label="Date worked (start of shift)" value={s.date} onChange={(date) => setS({ ...s, date })} />
      <p class="fine">{period ? `Pay period ${fmtDate(period.start, false)} – ${fmtDate(period.end, false)}, paid ${fmtDate(period.payDate)}` : 'Not in any pay period yet.'}</p>
      <label class="field">
        <span class="field-label">Type</span>
        <span class="field-input">
          <select value={s.type} onChange={(e) => {
            const type = (e.target as HTMLSelectElement).value as ShiftType
            setS({ ...s, type, ot: WORKED.has(type) ? s.ot : false })
          }}>
            {Object.entries(SHIFT_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </span>
      </label>
      <NumberField label="Paid hours" value={s.hours} onChange={(hours) => setS({ ...s, hours })} step="0.01" suffix="h" />
      {worked && <Toggle label="Overtime" hint="Paid at the OT rate instead of base pay" checked={s.ot} onChange={(ot) => setS({ ...s, ot })} />}
      <div class="row">
        <button class="primary" disabled={!(s.hours > 0)} onClick={() => p.onSave(s)}>Save</button>
        <button onClick={p.onCancel}>Cancel</button>
        {p.onDelete && <button class="danger" onClick={p.onDelete}>Delete</button>}
      </div>
    </section>
  )
}
