import { useState } from 'preact/hooks'
import type { Forecast, PeriodResult } from '../engine/forecast'
import { fmtCents, fmtDate, fmtHours, todayIso } from '../format'

export function PayTab({ forecast }: { forecast: Forecast }) {
  const today = todayIso()
  const next = forecast.periods.find((p) => p.period.payDate >= today)
  const years = [...new Set(forecast.periods.map((p) => p.taxYear))]

  if (forecast.periods.length === 0) {
    return <p class="empty">No pay periods yet. Add them in Setup → Pay periods, or import a backup.</p>
  }

  return (
    <div class="stack">
      {forecast.unassigned.length > 0 && (
        <p class="warn">
          {forecast.unassigned.length} shift(s) fall outside every pay period and are not counted. Add the missing
          periods in Setup.
        </p>
      )}
      {forecast.periods.map((p) => (
        <PayCard key={p.period.id} result={p} isNext={p === next} />
      ))}
      {years.map((y) => (
        <YearTotal key={y} year={y} periods={forecast.periods.filter((p) => p.taxYear === y)} />
      ))}
    </div>
  )
}

function PayCard({ result, isNext }: { result: PeriodResult; isNext: boolean }) {
  const [open, setOpen] = useState(isNext)
  const { period, pay } = result
  return (
    <section class={`card${isNext ? ' card-next' : ''}`}>
      <button class="card-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <span class="card-title">{fmtDate(period.payDate)}</span>
          <span class="card-sub">
            {fmtDate(period.start, false)} – {fmtDate(period.end, false)}
            {period.benefitPay ? ' · benefit pay' : ''}
            {isNext ? ' · next pay' : ''}
          </span>
        </span>
        <span class="card-amount">
          {pay ? fmtCents(pay.net) : '—'}
          {result.estimate && <span class="badge">Estimate</span>}
        </span>
      </button>
      {result.error && <p class="warn">{result.error}</p>}
      {open && pay && (
        <div class="card-body">
          <table class="lines">
            <thead>
              <tr><th>Earnings</th><th>Hours</th><th>Rate</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {pay.earnings.map((e) => (
                <tr key={e.code}>
                  <td>{e.label}</td><td>{fmtHours(e.hours)}</td><td>{e.rate.toFixed(4).replace(/0{1,2}$/, '')}</td><td>{fmtCents(e.cents)}</td>
                </tr>
              ))}
              {pay.reimbursement > 0 && <tr><td>Reimbursement</td><td /><td /><td>{fmtCents(pay.reimbursement)}</td></tr>}
              <tr class="total"><td>Gross</td><td /><td /><td>{fmtCents(pay.gross)}</td></tr>
            </tbody>
          </table>
          <table class="lines">
            <tbody>
              <Row label="Union dues" cents={pay.unionDues} />
              <Row label="LAPP pension" cents={pay.lapp} />
              <Row label="Income tax" cents={pay.incomeTax} />
              <Row label="CPP" cents={pay.cpp} />
              <Row label="CPP2" cents={pay.cpp2} />
              <Row label="EI" cents={pay.ei} />
              <Row label="UNA TFSA" cents={pay.tfsaEmployee} />
              <Row label="Benefit premiums" cents={pay.benefitPremiums} />
              <tr class="total"><td>Net pay</td><td>{fmtCents(pay.net)}</td></tr>
            </tbody>
          </table>
          <p class="fine">
            Taxable income {fmtCents(pay.taxableIncome)} (includes employer TFSA {fmtCents(pay.tfsaEmployer)}
            {pay.employerNonCash > 0 ? ` and taxable benefits ${fmtCents(pay.employerNonCash)}` : ''}). Year to date after
            this pay: CPP {fmtCents(pay.ytd.cpp)} · CPP2 {fmtCents(pay.ytd.cpp2)} · EI {fmtCents(pay.ytd.ei)}.
          </p>
          {result.estimate && (
            <p class="fine">Estimate: some {result.taxYear} tax-year values in Setup are not confirmed yet.</p>
          )}
        </div>
      )}
    </section>
  )
}

const Row = ({ label, cents }: { label: string; cents: number }) =>
  cents === 0 ? null : (
    <tr><td>{label}</td><td>−{fmtCents(cents)}</td></tr>
  )

function YearTotal({ year, periods }: { year: number; periods: PeriodResult[] }) {
  const sum = (f: (p: NonNullable<PeriodResult['pay']>) => number) =>
    periods.reduce((s, p) => s + (p.pay ? f(p.pay) : 0), 0)
  return (
    <section class="card totals">
      <h3>{year} total ({periods.length} pays shown)</h3>
      <table class="lines">
        <tbody>
          <tr><td>Gross</td><td>{fmtCents(sum((p) => p.gross))}</td></tr>
          <tr><td>Income tax</td><td>{fmtCents(sum((p) => p.incomeTax))}</td></tr>
          <tr><td>CPP + CPP2 + EI</td><td>{fmtCents(sum((p) => p.cpp + p.cpp2 + p.ei))}</td></tr>
          <tr class="total"><td>Net pay</td><td>{fmtCents(sum((p) => p.net))}</td></tr>
        </tbody>
      </table>
    </section>
  )
}
