import { useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { addDays } from '../engine/schedule'
import type { Bracket, NamedAmount, PayPeriod, Settings, TaxYear } from '../engine/types'
import { DateField, MoneyField, NumberField, PercentField, TextField, Toggle } from '../components/fields'
import { fmtDate } from '../format'
import { type AppData, exportBackup, readBackupFile } from '../store'

interface Props {
  data: AppData
  onSettings: (s: Settings) => void
  onReplaceAll: (d: AppData) => void
}

function Section({ title, children, open = false }: { title: string; children: ComponentChildren; open?: boolean }) {
  return (
    <details class="card section" open={open}>
      <summary>{title}</summary>
      <div class="section-body">{children}</div>
    </details>
  )
}

export function SetupTab({ data, onSettings, onReplaceAll }: Props) {
  const s = data.settings
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onSettings({ ...s, [key]: value })
  const pay = s.pay
  const setPay = (k: keyof typeof pay, v: number) => set('pay', { ...pay, [k]: v })
  const d = s.deductions
  const setDed = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => set('deductions', { ...d, [k]: v })

  return (
    <div class="stack">
      <Section title="Pay & premiums" open>
        <MoneyField label="Base hourly rate" value={pay.baseRate} onChange={(v) => setPay('baseRate', v)} />
        <MoneyField label="Evening / shift premium (per hour)" value={pay.eveningPremium} onChange={(v) => setPay('eveningPremium', v)} />
        <MoneyField label="Night differential (per hour)" value={pay.nightPremium} onChange={(v) => setPay('nightPremium', v)} />
        <MoneyField label="Weekend premium (per hour)" value={pay.weekendPremium} onChange={(v) => setPay('weekendPremium', v)} />
        <NumberField label="Overtime multiplier" value={pay.otMultiplier} onChange={(v) => setPay('otMultiplier', v)} suffix="x" />
        <NumberField label="Stat worked premium" value={pay.statPremium} onChange={(v) => setPay('statPremium', v)} suffix="x" hint="On top of 1x base for hours on a stat" />
        <NumberField label="Double-stat premium" value={pay.statPremiumDouble} onChange={(v) => setPay('statPremiumDouble', v)} suffix="x" hint="For stats marked 2.0x (e.g. Christmas)" />
        <NumberField label="Evening-premium hours per day shift" value={pay.eveningHoursPerDayShift} onChange={(v) => setPay('eveningHoursPerDayShift', v)} suffix="h" />
        <NumberField label="Weekend hours on a Friday day shift" value={pay.fridayDayWeekendHours} onChange={(v) => setPay('fridayDayWeekendHours', v)} suffix="h" />
        <NumberField label="Night shift hours before midnight" value={pay.nightHoursBeforeMidnight} onChange={(v) => setPay('nightHoursBeforeMidnight', v)} suffix="h" hint="Splits stat pay for night shifts at midnight" />
        <NumberField label="Default hours for a new shift" value={pay.defaultShiftHours} onChange={(v) => setPay('defaultShiftHours', v)} suffix="h" />
      </Section>

      <Section title="Deductions">
        <PercentField label="Union dues (% of gross)" value={d.unionDuesRate} onChange={(v) => setDed('unionDuesRate', v)} />
        <MoneyField label="Union dues levy (per pay)" value={d.unionLevy} onChange={(v) => setDed('unionLevy', v)} />
        <PercentField label="LAPP rate up to YMPE" value={d.lappRateLow} onChange={(v) => setDed('lappRateLow', v)} />
        <PercentField label="LAPP rate above YMPE" value={d.lappRateHigh} onChange={(v) => setDed('lappRateHigh', v)} />
        <PercentField label="TFSA – your contribution" value={d.tfsaEmployeeRate} onChange={(v) => setDed('tfsaEmployeeRate', v)} />
        <PercentField label="TFSA – employer contribution (taxable)" value={d.tfsaEmployerRate} onChange={(v) => setDed('tfsaEmployerRate', v)} />
        <h4>Benefit premiums (after tax, benefit pays only)</h4>
        <AmountList items={d.benefitPremiums} onChange={(v) => setDed('benefitPremiums', v)} />
        <h4>Employer-paid taxable benefits (benefit pays only)</h4>
        <AmountList items={d.employerTaxableBenefits} onChange={(v) => setDed('employerTaxableBenefits', v)} />
      </Section>

      <Section title="Tax years (CPP, EI, income tax)">
        {[...s.taxYears].sort((a, b) => a.year - b.year).map((ty) => (
          <TaxYearEditor
            key={ty.year}
            ty={ty}
            onChange={(n) => set('taxYears', s.taxYears.map((t) => (t.year === ty.year ? n : t)))}
            onDelete={() => confirm(`Delete the ${ty.year} tax year?`) && set('taxYears', s.taxYears.filter((t) => t.year !== ty.year))}
          />
        ))}
        <button onClick={() => {
          const last = [...s.taxYears].sort((a, b) => b.year - a.year)[0]
          const year = last ? last.year + 1 : new Date().getFullYear()
          set('taxYears', [...s.taxYears, { ...(last ?? s.taxYears[0]), year, confirmed: false }])
        }}>+ Add next tax year (copies the latest, unconfirmed)</button>
      </Section>

      <Section title="Pay periods">
        <PeriodsEditor periods={s.periods} onChange={(v) => set('periods', v)} />
      </Section>

      <Section title="Stat holidays">
        <StatsEditor stats={s.stats} onChange={(v) => set('stats', v)} />
      </Section>

      <Section title="Opening year-to-date">
        <p class="fine">Totals already deducted this year before the first pay period, from the pay stub just before it.</p>
        <NumberField label="Tax year" value={s.opening.year} onChange={(v) => set('opening', { ...s.opening, year: Math.round(v) })} step="1" />
        <MoneyField label="CPP year-to-date" value={s.opening.cpp} onChange={(v) => set('opening', { ...s.opening, cpp: v })} />
        <MoneyField label="CPP2 year-to-date" value={s.opening.cpp2} onChange={(v) => set('opening', { ...s.opening, cpp2: v })} />
        <MoneyField label="EI year-to-date" value={s.opening.ei} onChange={(v) => set('opening', { ...s.opening, ei: v })} />
        <MoneyField label="CPP pensionable earnings year-to-date" value={s.opening.pensionableEarnings} onChange={(v) => set('opening', { ...s.opening, pensionableEarnings: v })} hint="Gross plus taxable benefits so far; decides when CPP2 starts" />
      </Section>

      <Section title="Backup">
        <BackupPanel data={data} onReplaceAll={onReplaceAll} />
      </Section>
    </div>
  )
}

function AmountList({ items, onChange }: { items: NamedAmount[]; onChange: (v: NamedAmount[]) => void }) {
  const total = items.reduce((t, i) => t + Math.round(i.amount * 100), 0) / 100
  return (
    <div class="list">
      {items.map((it, i) => (
        <div class="list-row" key={i}>
          <TextField label="Name" value={it.name} onChange={(name) => onChange(items.map((x, j) => (j === i ? { ...x, name } : x)))} />
          <MoneyField label="Amount" value={it.amount} onChange={(amount) => onChange(items.map((x, j) => (j === i ? { ...x, amount } : x)))} />
          <button class="icon danger" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <div class="row">
        <button onClick={() => onChange([...items, { name: '', amount: 0 }])}>+ Add</button>
        <span class="fine">Total ${total.toFixed(2)}</span>
      </div>
    </div>
  )
}

function TaxYearEditor({ ty, onChange, onDelete }: { ty: TaxYear; onChange: (t: TaxYear) => void; onDelete: () => void }) {
  const f = <K extends keyof TaxYear>(k: K, v: TaxYear[K]) => onChange({ ...ty, [k]: v })
  return (
    <details class="subsection">
      <summary>{ty.year}{ty.confirmed ? '' : ' · not confirmed (pays show as Estimate)'}</summary>
      <Toggle label="All values confirmed against CRA" checked={ty.confirmed} onChange={(v) => f('confirmed', v)} />
      <PercentField label="CPP rate" value={ty.cppRate} onChange={(v) => f('cppRate', v)} />
      <PercentField label="CPP base rate (for tax credit)" value={ty.cppBaseRate} onChange={(v) => f('cppBaseRate', v)} />
      <MoneyField label="CPP basic exemption (year)" value={ty.cppExemption} onChange={(v) => f('cppExemption', v)} />
      <MoneyField label="YMPE" value={ty.ympe} onChange={(v) => f('ympe', v)} />
      <MoneyField label="YAMPE" value={ty.yampe} onChange={(v) => f('yampe', v)} />
      <PercentField label="CPP2 rate" value={ty.cpp2Rate} onChange={(v) => f('cpp2Rate', v)} />
      <PercentField label="EI rate" value={ty.eiRate} onChange={(v) => f('eiRate', v)} />
      <MoneyField label="EI maximum insurable earnings" value={ty.eiMaxInsurable} onChange={(v) => f('eiMaxInsurable', v)} />
      <MoneyField label="Federal TD1 claim amount" value={ty.federalClaim} onChange={(v) => f('federalClaim', v)} />
      <MoneyField label="Alberta TD1AB claim amount" value={ty.albertaClaim} onChange={(v) => f('albertaClaim', v)} />
      <MoneyField label="Canada employment amount" value={ty.canadaEmploymentAmount} onChange={(v) => f('canadaEmploymentAmount', v)} />
      <PercentField label="Federal credit rate (lowest bracket)" value={ty.federalCreditRate} onChange={(v) => f('federalCreditRate', v)} />
      <PercentField label="Alberta credit rate" value={ty.albertaCreditRate} onChange={(v) => f('albertaCreditRate', v)} />
      <NumberField label="Pays per year" value={ty.payPeriods} onChange={(v) => f('payPeriods', Math.round(v))} step="1" />
      <h4>Federal brackets</h4>
      <BracketsEditor brackets={ty.federalBrackets} onChange={(v) => f('federalBrackets', v)} />
      <h4>Alberta brackets</h4>
      <BracketsEditor brackets={ty.albertaBrackets} onChange={(v) => f('albertaBrackets', v)} />
      <button class="danger" onClick={onDelete}>Delete {ty.year}</button>
    </details>
  )
}

function BracketsEditor({ brackets, onChange }: { brackets: Bracket[]; onChange: (b: Bracket[]) => void }) {
  return (
    <div class="list">
      {brackets.map((b, i) => (
        <div class="list-row" key={i}>
          <MoneyField label="Income over" value={b.over} onChange={(over) => onChange(brackets.map((x, j) => (j === i ? { ...x, over } : x)))} />
          <PercentField label="Rate" value={b.rate} onChange={(rate) => onChange(brackets.map((x, j) => (j === i ? { ...x, rate } : x)))} />
          <button class="icon danger" aria-label="Remove" onClick={() => onChange(brackets.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button onClick={() => onChange([...brackets, { over: (brackets.at(-1)?.over ?? 0) + 1, rate: brackets.at(-1)?.rate ?? 0 }])}>+ Add bracket</button>
    </div>
  )
}

function nextPeriodId(prev: PayPeriod | undefined, payDate: string): string {
  const year = payDate.slice(0, 4)
  const m = prev?.id.match(/^(\d{4})_(\d+)$/)
  const n = m && m[1] === year ? Number(m[2]) + 1 : 1
  return `${year}_${String(n).padStart(2, '0')}`
}

function PeriodsEditor({ periods, onChange }: { periods: PayPeriod[]; onChange: (p: PayPeriod[]) => void }) {
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start))
  const [firstStart, setFirstStart] = useState('')
  const [firstPay, setFirstPay] = useState('')
  const update = (id: string, patch: Partial<PayPeriod>) => onChange(periods.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const last = sorted.at(-1)

  return (
    <div class="list">
      <p class="fine">Two-week periods. Change a pay date when a stat moves payday; the benefit switch marks pays with benefit premiums.</p>
      {sorted.map((p) => (
        <div class="period-row" key={p.id}>
          <div>
            <strong>{p.id}</strong>
            <span class="fine"> {fmtDate(p.start, false)} – {fmtDate(p.end)}</span>
          </div>
          <DateField label="Pay date" value={p.payDate} onChange={(payDate) => update(p.id, { payDate })} />
          <Toggle label="Benefit pay" checked={p.benefitPay} onChange={(benefitPay) => update(p.id, { benefitPay })} />
        </div>
      ))}
      {last ? (
        <div class="row">
          <button onClick={() => {
            const start = addDays(last.end, 1)
            const end = addDays(start, 13)
            const payDate = addDays(end, 10)
            onChange([...periods, { id: nextPeriodId(last, payDate), start, end, payDate, benefitPay: !last.benefitPay }])
          }}>+ Add next period</button>
          <button class="danger" onClick={() => confirm(`Remove period ${last.id}?`) && onChange(periods.filter((p) => p.id !== last.id))}>Remove last</button>
        </div>
      ) : (
        <div class="form">
          <DateField label="First period starts" value={firstStart} onChange={setFirstStart} />
          <DateField label="Its pay date" value={firstPay} onChange={setFirstPay} />
          <button class="primary" disabled={!firstStart || !firstPay} onClick={() =>
            onChange([{ id: nextPeriodId(undefined, firstPay), start: firstStart, end: addDays(firstStart, 13), payDate: firstPay, benefitPay: false }])
          }>Create first period</button>
        </div>
      )}
    </div>
  )
}

function StatsEditor({ stats, onChange }: { stats: Settings['stats']; onChange: (s: Settings['stats']) => void }) {
  const [date, setDate] = useState('')
  const sorted = [...stats].sort((a, b) => a.date.localeCompare(b.date))
  return (
    <div class="list">
      {sorted.map((st) => (
        <div class="list-row" key={st.date}>
          <span class="grow">{fmtDate(st.date)}</span>
          <Toggle label="2.0x" checked={st.double} onChange={(double) => onChange(stats.map((x) => (x.date === st.date ? { ...x, double } : x)))} />
          <button class="icon danger" aria-label="Remove" onClick={() => onChange(stats.filter((x) => x.date !== st.date))}>×</button>
        </div>
      ))}
      <div class="row">
        <DateField label="Add stat" value={date} onChange={setDate} />
        <button disabled={!date || stats.some((x) => x.date === date)} onClick={() => { onChange([...stats, { date, double: false }]); setDate('') }}>Add</button>
      </div>
    </div>
  )
}

function BackupPanel({ data, onReplaceAll }: { data: AppData; onReplaceAll: (d: AppData) => void }) {
  const [msg, setMsg] = useState('')
  return (
    <div class="list">
      <p class="fine">
        Your data lives only in this browser on this device. On iPhone, Safari can delete a website's data if you
        don't open it for 7 days, so export a backup regularly (and save it to Files or iCloud Drive).
      </p>
      <button class="primary" onClick={() => exportBackup(data)}>Export backup</button>
      <label class="button">
        Import backup…
        <input type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const input = e.target as HTMLInputElement
          const file = input.files?.[0]
          input.value = ''
          if (!file) return
          try {
            const next = await readBackupFile(file)
            if (confirm(`Replace everything on this device with "${file.name}" (${next.shifts.length} shifts)?`)) {
              onReplaceAll(next)
              setMsg(`Imported ${next.shifts.length} shifts and ${next.settings.periods.length} pay periods.`)
            }
          } catch (err) {
            setMsg((err as Error).message)
          }
        }} />
      </label>
      {msg && <p class="fine">{msg}</p>}
    </div>
  )
}
