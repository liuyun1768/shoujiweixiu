import 'dotenv/config'
import { createApp } from './app'
import { getConfiguredSqliteAbsPath } from './db/sqlite'

const port = Number(process.env.PORT || 3001)

const sqlitePath = getConfiguredSqliteAbsPath()
if (sqlitePath) {
  console.log('[shoujiweixiu-api] SQLITE_PATH ->', sqlitePath)
  const busy = process.env.SQLITE_BUSY_TIMEOUT_MS?.trim() || '15000(default)'
  console.log('[shoujiweixiu-api] SQLITE_BUSY_TIMEOUT_MS ->', busy)
} else {
  console.warn('[shoujiweixiu-api] SQLITE_PATH not set; SQLite API routes return 503')
}

createApp().listen(port, '0.0.0.0', () => {
  console.log(`[shoujiweixiu-api] http://127.0.0.1:${port}`)
})
