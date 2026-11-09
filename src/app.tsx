import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { defaultSelection } from './engine/dashboard'
import { computeForecast } from './engine/forecast'
import type { Settings, Shift } from './engine/types'
import { todayIso } from './format'
import { type AppData, loadData, loadSelection, requestPersistence, saveData, saveSelection } from './store'
import { DashboardTab } from './tabs/DashboardTab'
import { PayTab } from './tabs/PayTab'
import { ScheduleTab } from './tabs/ScheduleTab'
import { SetupTab } from './tabs/SetupTab'

type Tab = 'dashboard' | 'schedule' | 'pay' | 'setup'
const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'pay', label: 'Pay' },
  { id: 'setup', label: 'Setup' },
]

export function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selection, setSelection] = useState<string[] | null>(null)
  const [focusPay, setFocusPay] = useState<string | undefined>()
  const [saveError, setSaveError] = useState('')
  const loaded = useRef(false)

  useEffect(() => {
    loadData().then((d) => {
      setData(d)
      loaded.current = true
      if (d.settings.periods.length === 0) setTab('setup')
    })
    void requestPersistence()
  }, [])

  // Save every change; a short delay batches rapid typing.
  useEffect(() => {
    if (!data || !loaded.current) return
    const t = setTimeout(() => {
      saveData(data).then(() => setSaveError(''), (e: Error) => setSaveError(`Could not save: ${e.message}`))
    }, 300)
    return () => clearTimeout(t)
  }, [data])

  const forecast = useMemo(() => (data ? computeForecast(data.settings, data.shifts) : null), [data])

  // Dashboard selection: remembered on this device; pay periods that no longer exist are dropped,
  // and if none of the remembered ones remain, the next pay is selected.
  const dashboardSelection = useMemo(() => {
    if (!data) return []
    const ids = new Set(data.settings.periods.map((p) => p.id))
    const wanted = selection ?? loadSelection()
    if (wanted === null) return defaultSelection(data.settings.periods, todayIso())
    const valid = wanted.filter((id) => ids.has(id))
    return valid.length === 0 && wanted.length > 0 ? defaultSelection(data.settings.periods, todayIso()) : valid
  }, [data, selection])

  if (!data || !forecast) return <p class="empty">Loading…</p>

  const setSettings = (settings: Settings) => setData({ ...data, settings })
  const setShifts = (shifts: Shift[]) => setData({ ...data, shifts })
  const select = (ids: string[]) => {
    setSelection(ids)
    saveSelection(ids)
  }
  const go = (t: Tab) => {
    setFocusPay(undefined)
    setTab(t)
  }

  return (
    <div class="app">
      <header class="top">
        <h1>{TABS.find((t) => t.id === tab)!.label}</h1>
      </header>
      {saveError && <p class="warn">{saveError}</p>}
      <main>
        {tab === 'dashboard' && (
          <DashboardTab
            settings={data.settings}
            shifts={data.shifts}
            selected={dashboardSelection}
            onSelect={select}
            onOpenPay={(id) => {
              setFocusPay(id)
              setTab('pay')
            }}
          />
        )}
        {tab === 'schedule' && <ScheduleTab settings={data.settings} shifts={data.shifts} onChange={setShifts} />}
        {tab === 'pay' && <PayTab forecast={forecast} focusId={focusPay} />}
        {tab === 'setup' && <SetupTab data={data} onSettings={setSettings} onReplaceAll={setData} />}
      </main>
      <nav class="tabbar">
        {TABS.map((t) => (
          <button key={t.id} class={tab === t.id ? 'active' : ''} onClick={() => go(t.id)} aria-current={tab === t.id}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
