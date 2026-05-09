import { Router } from 'express'
import { getSqlite } from '../db/sqlite'

export const REPAIR_STAFF_KV_PATH = 'repair/staff_state_v1'

export const repairStaffRouter = Router()

type StaffProfile = {
  name: string
  pin: string
  phone?: string
  viewAllOrders?: boolean
}

type StaffState = { revision: number; profiles: StaffProfile[] }

const SUPER_ADMIN = 'admin'

function normalizePhone(raw: string): string {
  return String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, 11)
}

function normalizeProfiles(list: unknown[]): StaffProfile[] {
  const usedPhones = new Set<string>()
  const map = new Map<string, StaffProfile>()
  for (const x of list) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const name = String(o.name ?? '').trim()
    if (!name) continue
    const pin = String(o.pin ?? '123456').trim() || '123456'
    let phone = normalizePhone(String(o.phone ?? ''))
    if (phone.length !== 11) phone = ''
    if (phone && usedPhones.has(phone)) phone = ''
    if (phone) usedPhones.add(phone)
    const vo = o.viewAllOrders
    const viewAll =
      name.toLowerCase() === SUPER_ADMIN ? undefined : vo === true || vo === 'true' ? true : undefined
    const row: StaffProfile = { name, pin, ...(phone ? { phone } : {}), ...(viewAll ? { viewAllOrders: true } : {}) }
    map.set(name.toLowerCase(), row)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

function readState(sqlite: NonNullable<ReturnType<typeof getSqlite>>): StaffState {
  const row = sqlite
    .prepare('SELECT value FROM kv_store WHERE path = ?')
    .get(REPAIR_STAFF_KV_PATH) as { value: string } | undefined
  if (!row?.value?.trim()) {
    return { revision: 0, profiles: [] }
  }
  try {
    const j = JSON.parse(row.value) as { revision?: unknown; profiles?: unknown }
    const revision = Number(j.revision) || 0
    const arr = Array.isArray(j.profiles) ? j.profiles : []
    return { revision, profiles: normalizeProfiles(arr as unknown[]) }
  } catch {
    return { revision: 0, profiles: [] }
  }
}

function writeState(sqlite: NonNullable<ReturnType<typeof getSqlite>>, state: StaffState): void {
  const text = JSON.stringify(state)
  sqlite
    .prepare(
      `INSERT INTO kv_store (path, value, updated_at) VALUES (?, ?, strftime('%s','now'))
       ON CONFLICT(path) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(REPAIR_STAFF_KV_PATH, text)
}

repairStaffRouter.get('/repair/staff', (_req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    res.status(503).json({ ok: false, message: 'sqlite_not_configured' })
    return
  }
  try {
    const { revision, profiles } = readState(sqlite)
    res.json({ ok: true, revision, profiles })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'read_failed' })
  }
})

repairStaffRouter.put('/repair/staff', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    res.status(503).json({ ok: false, message: 'sqlite_not_configured' })
    return
  }
  const raw = req.body?.profiles
  if (!Array.isArray(raw)) {
    res.status(400).json({ ok: false, message: 'profiles_must_be_array' })
    return
  }
  try {
    const prev = readState(sqlite)
    const profiles = normalizeProfiles(raw as unknown[])
    const next: StaffState = { revision: prev.revision + 1, profiles }
    writeState(sqlite, next)
    res.json({ ok: true, revision: next.revision, profiles: next.profiles })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'write_failed' })
  }
})

repairStaffRouter.post('/repair/staff/login', (req, res) => {
  const sqlite = getSqlite()
  if (!sqlite) {
    res.status(503).json({ ok: false, message: 'sqlite_not_configured' })
    return
  }
  const identifier = String(req.body?.identifier ?? '').trim()
  const pin = String(req.body?.pin ?? '').trim()
  if (!identifier || !pin) {
    res.status(400).json({ ok: false, message: 'identifier_and_pin_required' })
    return
  }
  try {
    const { profiles } = readState(sqlite)
    const digits = normalizePhone(identifier)
    let found: StaffProfile | undefined
    if (digits.length === 11) {
      found = profiles.find((p) => normalizePhone(p.phone ?? '') === digits)
    }
    if (!found) {
      found = profiles.find((p) => p.name.toLowerCase() === identifier.toLowerCase())
    }
    if (!found || found.pin !== pin) {
      res.status(401).json({ ok: false, message: 'invalid_credentials' })
      return
    }
    res.json({ ok: true, staffName: found.name })
  } catch (e) {
    res.status(500).json({ ok: false, message: e instanceof Error ? e.message : 'login_failed' })
  }
})
