import { useState } from 'preact/hooks'
import { periodForDate, shiftHours } from '../engine/schedule'
import type { Settings, Shift, ShiftType } from '../engine/types'
import { DateField, NumberField, Toggle } from '../components/fields'
import { fmtDate, fmtDayDate, fmtHours, SHIFT_TYPE_LABELS, todayIso } from '../format'
import { newId } from '../store'

interface Props {
  settings: Settings
  shifts: Shift[]
  onChange: (shifts: Shift[]) => void
}

const WORKED = new Set<ShiftType>(['day', 'evening', 'night'])

export function ScheduleTab({ settings, shifts, onChange }: Props) {
  const [editing, setEditing] = useState<Shift | null>(null)
  const periods = [...settings.periods].sort((a, b) => a.start.localeCompare(b.start))
  const unassigned = shifts.filter((s) => !periodForDate(s.date, periods))

  const startNew = () => {
    const last = [...shifts].sort((a, b) => b.date.localeCompare(a.date))[0]
    setEditing({ id: '', date: last ? last.date : todayIso(), type: 'day', hours: settings.pay.defaultShiftHours, ot: false })
  }
  const save = (s: Shift) => {
    onChange(s.id ? shifts.map((x) => (x.id === s.id ? s : x)) : [...shifts, { ...s, id: newId() }])
    setEditing(null)
  }
  const remove = (id: string) => {
    if (!confirm('Delete this shift?')) return
    onChange(shifts.filter((x) => x.id !== id))
    setEditing(null)
  }

  return (
    <div class="stack">
      {editing ? (
        <ShiftForm shift={editing} settings={settings} onSave={save} onCancel={() => setEditing(null)} onDelete={editing.id ? () => remove(editing.id) : undefined} />
      ) : (
        <button class="primary" onClick={startNew}>+ Add shift</button>
      )}
      {unassigned.length > 0 && (
        <section class="card">
          <h3 class="warn-title">Not in any pay period</h3>
          <ShiftList shifts={unassigned} settings={settings} onEdit={setEditing} />
        </section>
      )}
      {periods.length === 0 && <p class="empty">Add pay periods in Setup first.</p>}
      {periods.map((p) => {
        const inPeriod = shifts.filter((s) => s.date >= p.start && s.date <= p.end).sort((a, b) => a.date.localeCompare(b.date))
        return (
          <section class="card" key={p.id}>
            <h3>
              {fmtDate(p.start, false)} – {fmtDate(p.end, false)}
              <span class="card-sub"> · paid {fmtDate(p.payDate)}</span>
            </h3>
            {inPeriod.length === 0 ? <p class="fine">No shifts.</p> : <ShiftList shifts={inPeriod} settings={settings} onEdit={setEditing} />}
          </section>
        )
      })}
    </div>
  )
}

function ShiftList({ shifts, settings, onEdit }: { shifts: Shift[]; settings: Settings; onEdit: (s: Shift) => void }) {
  return (
    <ul class="shifts">
      {shifts.map((s) => {
        const h = shiftHours(s, settings.pay, settings.stats)
        const parts = [
          h.evening && `eve ${fmtHours(h.evening / 100)}`,
          h.night && `night ${fmtHours(h.night / 100)}`,
          h.weekend && `wknd ${fmtHours(h.weekend / 100)}`,
          h.statPremium + h.statPremiumDouble && `stat ${fmtHours((h.statPremium + h.statPremiumDouble) / 100)}${h.statPremiumDouble ? ' (2.0x)' : ''}`,
        ].filter(Boolean)
        return (
          <li key={s.id}>
            <button class="shift" onClick={() => onEdit(s)}>
              <span class="shift-date">{fmtDayDate(s.date)}</span>
              <span class="shift-main">
                {SHIFT_TYPE_LABELS[s.type]} · {fmtHours(s.hours)} h{s.ot ? <span class="badge">OT</span> : null}
              </span>
              {parts.length > 0 && <span class="shift-detail">{parts.join(' · ')}</span>}
            </button>
          </li>
        )
      })}
    </ul>
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
