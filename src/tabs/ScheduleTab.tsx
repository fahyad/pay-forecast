import { useState } from 'preact/hooks'
import { shiftNetImpact } from '../engine/forecast'
import { clockHours, kindFromTimes, suggestedPaidHours } from '../engine/clock'
import { lineCents } from '../engine/money'
import { addDays, periodForDate, shiftHours } from '../engine/schedule'
import type { Settings, Shift, ShiftPreset, ShiftType } from '../engine/types'
import { DateField, TimeField, Toggle } from '../components/fields'
import { fmtDate, fmtDayDate, fmtDollars, fmtHours, SHIFT_TYPE_LABELS, todayIso } from '../format'
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
  const newShift = (date: string): Shift => {
    const preset = settings.pay.shiftPresets[0]
    if (!preset) return { id: '', date, type: 'day', hours: settings.pay.defaultShiftHours, ot: false }
    return {
      id: '', date, ot: preset.ot, start: preset.start, end: preset.end,
      type: kindFromTimes(preset.start, preset.end, settings.pay),
      hours: suggestedPaidHours(preset.start, preset.end, preset.ot, settings.pay),
    }
  }

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
  const pay = settings.pay
  const h = shiftHours(shift, pay, settings.stats)
  const net = shiftNetImpact(settings, shifts, shift.id)
  const leaveHours = Object.values(h.leave).reduce((a, b) => a + (b ?? 0), 0)
  // [label, hundredths of an hour, rate]: each row's dollars are hours x rate, rounded like payroll.
  const rows: [string, number, number][] = [
    shift.ot ? [`OT ${pay.otMultiplier}x`, h.ot, pay.baseRate * pay.otMultiplier] : ['Base', h.regular + h.statWorked + leaveHours, pay.baseRate],
    ['Evening diff', h.evening, pay.eveningPremium],
    ['Night diff', h.night, pay.nightPremium],
    ['Weekend premium', h.weekend, pay.weekendPremium],
    ['Stat premium', h.statPremium, pay.baseRate * pay.statPremium],
    [`Stat premium ${(1 + pay.statPremiumDouble).toFixed(1)}x`, h.statPremiumDouble, pay.baseRate * pay.statPremiumDouble],
  ]
  const shown = rows.filter(([, hundredths]) => hundredths > 0).map(([label, hundredths, rate]) => ({ label, hours: hundredths / 100, cents: lineCents(hundredths / 100, rate) }))
  const gross = shown.reduce((t, r) => t + r.cents, 0)
  const nextDay = shift.start && shift.end && shift.end <= shift.start
  return (
    <div class="shift-detail-card">
      <div class="shift-detail-head">
        <span class="shift-detail-type">
          {SHIFT_TYPE_LABELS[shift.type]}{WORKED.has(shift.type) ? ' shift' : ''}
          {shift.ot && <span class="badge badge-ot">Overtime</span>}
        </span>
        <span class="shift-detail-hours">{fmtHours(shift.hours)} h</span>
      </div>
      {shift.start && shift.end ? (
        <p class="shift-detail-times">{shift.start}–{shift.end}{nextDay ? ' (next day)' : ''}</p>
      ) : (
        WORKED.has(shift.type) && <p class="shift-detail-times unset">Times not set — tap Edit to add them</p>
      )}
      <table class="lines shift-lines">
        <tbody>
          {shown.map((r) => (
            <tr key={r.label}><td>{r.label}</td><td class="h">{fmtHours(r.hours)}</td><td>{fmtDollars(r.cents)}</td></tr>
          ))}
          <tr class="sum"><td>Gross (approx.)</td><td /><td>{fmtDollars(gross)}</td></tr>
          {net && <tr class="sum net"><td>Net ({net.estimate ? 'estimate' : 'approx.'})</td><td /><td>{fmtDollars(net.total)}</td></tr>}
        </tbody>
      </table>
      <div class="row">
        <button onClick={onEdit}>Edit</button>
        <button class="danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

type FormKind = 'worked' | Exclude<ShiftType, 'day' | 'evening' | 'night'>
const KIND_LABELS: Record<FormKind, string> = {
  worked: 'Worked shift',
  sick: SHIFT_TYPE_LABELS.sick,
  statHoliday: SHIFT_TYPE_LABELS.statHoliday,
  vacation: SHIFT_TYPE_LABELS.vacation,
  orientation: SHIFT_TYPE_LABELS.orientation,
  personalLeave: SHIFT_TYPE_LABELS.personalLeave,
  floaterStat: SHIFT_TYPE_LABELS.floaterStat,
  unpaid: SHIFT_TYPE_LABELS.unpaid,
}

export function ShiftForm(p: { shift: Shift; settings: Settings; onSave: (s: Shift) => void; onCancel: () => void; onDelete?: () => void }) {
  const pay = p.settings.pay
  const presets = pay.shiftPresets
  const init = p.shift
  const [date, setDate] = useState(init.date)
  const [kind, setKind] = useState<FormKind>(WORKED.has(init.type) ? 'worked' : (init.type as FormKind))
  const [start, setStart] = useState(init.start ?? '')
  const [end, setEnd] = useState(init.end ?? '')
  const [ot, setOt] = useState(init.ot)
  const [hours, setHours] = useState(init.hours)
  // A new shift or one with times gets suggested paid hours until the user types their own.
  const [paidEdited, setPaidEdited] = useState(Boolean(init.id) && !(init.start && init.end))
  // What the user is typing in the paid-hours box (null = show the value formatted to 2 decimals).
  const [paidText, setPaidText] = useState<string | null>(null)

  const worked = kind === 'worked'
  const timed = worked && /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end)
  const suggested = timed ? suggestedPaidHours(start, end, ot, pay) : hours
  const paid = paidEdited || !timed ? hours : suggested
  const activePreset = presets.find((x) => x.start === start && x.end === end && x.ot === ot)
  const period = periodForDate(date, p.settings.periods)
  const nextDay = timed && end <= start

  const applyPreset = (preset: ShiftPreset) => {
    setStart(preset.start)
    setEnd(preset.end)
    setOt(preset.ot)
    setPaidEdited(false)
  }
  const save = () => {
    const base = { id: init.id, date, hours: paid, ot: worked && ot }
    if (!worked) return p.onSave({ ...base, type: kind, ot: false })
    if (timed) return p.onSave({ ...base, type: kindFromTimes(start, end, pay), start, end })
    // Worked shift without times: keep its type and the estimate-based premiums.
    return p.onSave({ ...base, type: WORKED.has(init.type) ? init.type : 'day' })
  }

  return (
    <section class="card form">
      <h3>{init.id ? 'Edit shift' : 'New shift'}</h3>
      <DateField label="Date (start of shift)" value={date} onChange={setDate} />
      <p class="fine">{period ? `Paid ${fmtDate(period.payDate)}` : 'Not in any pay period yet.'}</p>
      <label class="field">
        <span class="field-label">Type</span>
        <span class="field-input">
          <select value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as FormKind)}>
            {Object.entries(KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </span>
      </label>
      {worked && (
        <>
          {presets.length > 0 && (
            <div class="presets" role="group" aria-label="Shift presets">
              {presets.map((x) => (
                <button key={x.name} class={`preset${x.ot ? ' preset-ot' : ''}${activePreset === x ? ' on' : ''}`} onClick={() => applyPreset(x)}>
                  {x.name} <span class="preset-time">{x.start}–{x.end}</span>
                </button>
              ))}
            </div>
          )}
          <div class="times">
            <TimeField label="Start" value={start} onChange={(v) => { setStart(v); setPaidEdited(false) }} />
            <TimeField label="End" value={end} onChange={(v) => { setEnd(v); setPaidEdited(false) }} hint={nextDay ? `ends next day (${fmtDayDate(addDays(date, 1))})` : undefined} />
          </div>
          <Toggle label="Overtime" hint="Paid at the OT rate instead of base pay" checked={ot} onChange={(v) => { setOt(v); setPaidEdited(false) }} />
        </>
      )}
      <div class="paid-box">
        <span>
          <span class="paid-label">Paid hours</span>
          <span class="field-hint">
            {!timed ? (worked ? 'no times: premiums are estimated' : 'leave: paid hours only')
              : paidEdited ? 'edited by you' : ot ? 'overtime pays every clock hour' : clockHours(start, end) === 12 ? `12-hour shift pays ${pay.twelveHourPaid}` : 'clock hours'}
          </span>
        </span>
        <input
          type="number" inputMode="decimal" step="0.01" value={paidText ?? paid.toFixed(2)}
          onInput={(e) => {
            const t = (e.target as HTMLInputElement).value
            setPaidText(t)
            const n = Number(t)
            if (t.trim() !== '' && Number.isFinite(n)) { setHours(n); setPaidEdited(true) }
          }}
          onBlur={() => setPaidText(null)}
        />
      </div>
      <div class="row">
        <button class="primary" disabled={!(paid > 0)} onClick={save}>Save</button>
        <button onClick={p.onCancel}>Cancel</button>
        {p.onDelete && <button class="danger" onClick={p.onDelete}>Delete</button>}
      </div>
    </section>
  )
}
