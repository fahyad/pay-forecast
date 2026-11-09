// On-device storage (IndexedDB) and the JSON backup format. Nothing leaves the device.
import { get, set } from 'idb-keyval'
import { DEFAULT_SETTINGS } from './engine/defaults'
import type { Settings, Shift } from './engine/types'

export interface AppData {
  app: 'pay-forecast'
  version: 1
  settings: Settings
  shifts: Shift[]
}

const KEY = 'pay-forecast-data'

export const emptyData = (): AppData => ({
  app: 'pay-forecast',
  version: 1,
  settings: structuredClone(DEFAULT_SETTINGS),
  shifts: [],
})

export async function loadData(): Promise<AppData> {
  try {
    const stored = await get<AppData>(KEY)
    return stored ? parseData(stored) : emptyData()
  } catch {
    return emptyData()
  }
}

export async function saveData(data: AppData): Promise<void> {
  await set(KEY, data)
}

/** Ask the browser not to evict our data (best effort; Safari may still clear unused sites). */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/** Validate a backup or stored object. Throws with a readable message when it is not usable. */
export function parseData(raw: unknown): AppData {
  const d = raw as Partial<AppData> | null
  if (!d || d.app !== 'pay-forecast') throw new Error('This file is not a Pay Forecast backup.')
  if (d.version !== 1) throw new Error(`Unsupported backup version: ${String(d.version)}`)
  const s = d.settings
  if (!s?.pay || !s.deductions || !Array.isArray(s.taxYears) || !Array.isArray(s.periods) || !Array.isArray(s.stats) || !s.opening) {
    throw new Error('The backup is missing part of its Setup.')
  }
  if (!Array.isArray(d.shifts)) throw new Error('The backup has no shift list.')
  // Settings added after the first release get their defaults when missing.
  const settings: Settings = { ...(s as Settings), pay: { ...DEFAULT_SETTINGS.pay, ...(s as Settings).pay } }
  const bad = d.shifts.find((x) => !/^\d{4}-\d{2}-\d{2}$/.test(x?.date) || typeof x.hours !== 'number' || !x.type)
  if (bad) throw new Error(`A shift in the backup is not valid: ${JSON.stringify(bad)}`)
  const badTime = d.shifts.find((x) => (x.start !== undefined || x.end !== undefined) && !(/^\d{2}:\d{2}$/.test(x.start ?? '') && /^\d{2}:\d{2}$/.test(x.end ?? '')))
  if (badTime) throw new Error(`A shift in the backup has an invalid start/end time: ${JSON.stringify(badTime)}`)
  return { app: 'pay-forecast', version: 1, settings, shifts: d.shifts as Shift[] }
}

export function backupFileName(today = new Date()): string {
  return `pay-forecast-backup-${today.toISOString().slice(0, 10)}.json`
}

/** Save the data as a JSON file (on iPhone this opens the share sheet / Files). */
export function exportBackup(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName()
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function readBackupFile(file: File): Promise<AppData> {
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  return parseData(raw)
}

export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const SELECTION_KEY = 'pay-forecast-dashboard-selection'

/** Dashboard pay-cycle selection, remembered per device (a convenience; losing it is harmless). */
export function loadSelection(): string[] | null {
  try {
    const raw = localStorage.getItem(SELECTION_KEY)
    const ids = raw ? JSON.parse(raw) : null
    return Array.isArray(ids) && ids.every((x) => typeof x === 'string') ? ids : null
  } catch {
    return null
  }
}

export function saveSelection(ids: string[]): void {
  try {
    localStorage.setItem(SELECTION_KEY, JSON.stringify(ids))
  } catch {
    // Storage unavailable (e.g. private browsing): the selection just isn't remembered.
  }
}
