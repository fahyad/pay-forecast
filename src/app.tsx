import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { computeForecast } from './engine/forecast'
import type { Settings, Shift } from './engine/types'
import { type AppData, loadData, requestPersistence, saveData } from './store'
import { PayTab } from './tabs/PayTab'
import { ScheduleTab } from './tabs/ScheduleTab'
import { SetupTab } from './tabs/SetupTab'

type Tab = 'schedule' | 'pay' | 'setup'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'schedule', label: 'Schedule', icon: '📅' },
  { id: 'pay', label: 'Pay', icon: '💵' },
  { id: 'setup', label: 'Setup', icon: '⚙️' },
]

export function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [tab, setTab] = useState<Tab>('pay')
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

  if (!data || !forecast) return <p class="empty">Loading…</p>

  const setSettings = (settings: Settings) => setData({ ...data, settings })
  const setShifts = (shifts: Shift[]) => setData({ ...data, shifts })

  return (
    <div class="app">
      <header class="top">
        <h1>{TABS.find((t) => t.id === tab)!.label}</h1>
      </header>
      {saveError && <p class="warn">{saveError}</p>}
      <main>
        {tab === 'schedule' && <ScheduleTab settings={data.settings} shifts={data.shifts} onChange={setShifts} />}
        {tab === 'pay' && <PayTab forecast={forecast} />}
        {tab === 'setup' && <SetupTab data={data} onSettings={setSettings} onReplaceAll={setData} />}
      </main>
      <nav class="tabbar">
        {TABS.map((t) => (
          <button key={t.id} class={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
            <span class="tab-icon" aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
