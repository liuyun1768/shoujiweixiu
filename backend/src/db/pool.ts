import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool | null {
  if (pool) return pool

  const host = process.env.MYSQL_HOST
  const user = process.env.MYSQL_USER
  const database = process.env.MYSQL_DATABASE

  if (!host || !user || !database) {
    return null
  }

  pool = mysql.createPool({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user,
    password: process.env.MYSQL_PASSWORD ?? '',
    database,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
  })

  return pool
}
