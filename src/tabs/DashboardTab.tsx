import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { type CycleSummary, type DayCell, summarizeDashboard } from '../engine/dashboard'
import { taxYearOf } from '../engine/forecast'
import { addDays } from '../engine/schedule'
import type { Settings, Shift } from '../engine/types'
import { fmtDate, fmtDayDate, fmtDollars, fmtHours, leaveParts, SHIFT_TYPE_LABELS } from '../format'

interface Props {
  settings: Settings
  shifts: Shift[]
  selected: string[]
  onSelect: (ids: string[]) => void
  /** Show one pay's stub-style breakdown on the Pay tab. */
  onOpenPay: (periodId: string) => void
}

export function DashboardTab({ settings, shifts, selected, onSelect, onOpenPay }: Props) {
  const [picked, setPicked] = useState<string | null>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const periods = useMemo(() => [...settings.periods].sort((a, b) => a.payDate.localeCompare(b.payDate)), [settings.periods])
  const summary = useMemo(() => summarizeDashboard(settings, shifts, selected), [settings, shifts, selected])
  const isEstimate = (payDate: string) => !settings.taxYears.find((t) => t.year === taxYearOf(payDate))?.confirmed

  // On opening, scroll the chip row so the first selected pay date is in view.
  useEffect(() => {
    const row = chipsRef.current
    const chip = row?.querySelector<HTMLElement>('.paychip.on')
    if (row && chip) row.scrollLeft = chip.offsetLeft - row.offsetLeft - 16
  }, [])

  if (periods.length === 0) return <p class="empty">No pay periods yet. Add them in Setup.</p>

  const toggle = (id: string) => {
    setPicked(null)
    onSelect(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <div class="dash">
      <div class="paychips" role="group" aria-label="Pay dates" ref={chipsRef}>
        {periods.map((p) => (
          <button key={p.id} class={`paychip${selected.includes(p.id) ? ' on' : ''}`} aria-pressed={selected.includes(p.id)} onClick={() => toggle(p.id)}>
            {fmtDate(p.payDate, false)}
            {isEstimate(p.payDate) && <span class="paychip-est">est.</span>}
          </button>
        ))}
      </div>

      {summary.cycles.length === 0 ? (
        <p class="empty">Tap a pay date to see its breakdown.</p>
      ) : (
        <>
          <Heatmap cycles={summary.cycles} picked={picked} onPick={(d) => setPicked(picked === d ? null : d)} />

          {summary.missing.length > 0 && (
            <p class="warn">Can't calculate {summary.missing.map((p) => fmtDate(p.payDate)).join(', ')}: add its tax year in Setup.</p>
          )}

          {summary.cycles.length > 1 && (
            <section class="dash-total">
              <div class="dash-total-label">
                Net pay{summary.estimate && <span class="badge">incl. estimate</span>}
              </div>
              <div class="dash-total-net">{fmtDollars(summary.net)}</div>
              <div class="dash-tiles">
                <div class="dash-tile">
                  <div class="k">Regular</div>
                  <div class="v">{fmtDollars(summary.regularAdds)}</div>
                  <div class="s">{summary.regular} shifts</div>
                </div>
                <div class="dash-tile ot">
                  <div class="k">Overtime</div>
                  <div class="v">{fmtDollars(summary.overtimeAdds)}</div>
                  <div class="s">{summary.overtime} shifts</div>
                </div>
              </div>
            </section>
          )}

          <div class="dash-list">
            {summary.cycles.map((c) => (
              <button key={c.period.id} class="dash-row" onClick={() => onOpenPay(c.period.id)}>
                <span>
                  <span class="dash-row-date">
                    {fmtDate(c.period.payDate, false)}
                    {c.estimate && <span class="badge">Estimate</span>}
                  </span>
                  <span class="dash-row-meta">
                    {c.regular} regular
                    {c.overtime > 0 && <> · <span class="ot-text">{c.overtime} OT</span></>}
                    {leaveParts(c.leave).map((t) => ` · ${t}`).join('')}
                  </span>
                </span>
                <span class="dash-row-amt">{c.net === null ? '—' : fmtDollars(c.net)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const WEEKDAY_LETTERS = ['M', '', 'W', '', 'F', '', 'S']
/** Monday = 0 ... Sunday = 6. */
const mondayIndex = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7

function Heatmap({ cycles, picked, onPick }: { cycles: CycleSummary[]; picked: string | null; onPick: (date: string) => void }) {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
  const days = cycles.flatMap((c) => c.days)
  const pickedDay = picked ? days.find((d) => d.date === picked) : undefined
  const worked = days.filter((d) => d.kind === 'regular' || d.kind === 'overtime').length
  const leave = leaveParts(
    days.filter((d) => d.kind === 'leave').reduce<Record<string, number>>((acc, d) => {
      for (const s of d.shifts) acc[s.type] = (acc[s.type] ?? 0) + 1
      return acc
    }, {}),
  )

  return (
    <section class="heat">
      <div class="heat-grid">
        <div class="heat-days" aria-hidden="true">
          {WEEKDAY_LETTERS.map((l, i) => <span key={i}>{l}</span>)}
        </div>
        {cycles.map((c) => {
          const firstMonday = addDays(c.period.start, -mondayIndex(c.period.start))
          const week = (d: string) => Math.floor((Date.parse(d) - Date.parse(firstMonday)) / (7 * 86_400_000))
          return (
            <div class="heat-cycle" key={c.period.id}>
              <div class="heat-cols">
                {c.days.map((d) => (
                  <button
                    key={d.date}
                    class={`cell ${d.kind}${d.date === today ? ' today' : ''}${d.date === picked ? ' sel' : ''}`}
                    style={{ gridRow: mondayIndex(d.date) + 1, gridColumn: week(d.date) + 1 }}
                    aria-label={dayText(d)}
                    onClick={() => onPick(d.date)}
                  />
                ))}
              </div>
              <div class="heat-label">{fmtDate(c.period.payDate, false)}</div>
            </div>
          )
        })}
      </div>
      <div class="heat-info">
        {pickedDay ? (
          <>
            <b>{fmtDayDate(pickedDay.date)}</b> · {shiftText(pickedDay)}
          </>
        ) : (
          [`${worked} days worked`, ...leave].join(' · ')
        )}
      </div>
    </section>
  )
}

function shiftText(d: DayCell): string {
  if (d.shifts.length === 0) return 'Off'
  return d.shifts.map((s) => `${SHIFT_TYPE_LABELS[s.type]} · ${fmtHours(s.hours)} h${s.ot ? ' OT' : ''}`).join(' + ')
}

const dayText = (d: DayCell) => `${fmtDayDate(d.date)}: ${shiftText(d)}`
