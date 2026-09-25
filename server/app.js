import { createClient } from '@libsql/client/web'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import express from 'express'

try {
  process.loadEnvFile()
} catch {
  // No .env file present — e.g. on Vercel, where env vars are injected directly.
}

const REQUIRED_ENV_VARS = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'VITE_FIREBASE_PROJECT_ID']
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variable(s): ${missingEnvVars.join(', ')}`)
}

const projectId = process.env.VITE_FIREBASE_PROJECT_ID

const firebaseJWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
)

async function verifyFirebaseIdToken(token) {
  const { payload } = await jwtVerify(token, firebaseJWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  })
  return payload
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

async function initSchema() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      user_id TEXT
    )
  `)

  const columns = (await db.execute('PRAGMA table_info(expenses)')).rows
  if (!columns.some((col) => col.name === 'user_id')) {
    await db.execute('ALTER TABLE expenses ADD COLUMN user_id TEXT')
  }
}

let schemaReady = null
function ensureSchema() {
  schemaReady ??= initSchema().catch((err) => {
    schemaReady = null
    throw err
  })
  return schemaReady
}

const app = express()
app.use(express.json())

app.use('/api', async (req, res, next) => {
  await ensureSchema()
  next()
})

app.use('/api', async (req, res, next) => {
  const authHeader = req.headers.authorization ?? ''
  const [scheme, token] = authHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    console.error('Auth rejected: missing or malformed Authorization header')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const payload = await verifyFirebaseIdToken(token)
    req.userId = payload.sub
    next()
  } catch (err) {
    console.error(`Auth rejected: ${err.message}`)
    res.status(401).json({ error: 'Unauthorized' })
  }
})

app.get('/api/expenses', async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC',
    args: [req.userId],
  })
  res.json(result.rows)
})

app.post('/api/expenses', async (req, res) => {
  const { amount, category, date, note } = req.body
  if (amount == null || !category || !date) {
    return res.status(400).json({ error: 'amount, category, and date are required' })
  }
  const result = await db.execute({
    sql: 'INSERT INTO expenses (amount, category, date, note, user_id) VALUES (?, ?, ?, ?, ?)',
    args: [Number(amount), category, date, note ?? '', req.userId],
  })
  const created = await db.execute({
    sql: 'SELECT * FROM expenses WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  })
  res.status(201).json(created.rows[0])
})

app.put('/api/expenses/:id', async (req, res) => {
  const { id } = req.params
  const existingResult = await db.execute({
    sql: 'SELECT * FROM expenses WHERE id = ? AND user_id = ?',
    args: [id, req.userId],
  })
  const existing = existingResult.rows[0]
  if (!existing) return res.status(404).json({ error: 'Expense not found' })

  const { amount, category, date, note } = req.body
  await db.execute({
    sql: 'UPDATE expenses SET amount = ?, category = ?, date = ?, note = ? WHERE id = ? AND user_id = ?',
    args: [
      amount != null ? Number(amount) : existing.amount,
      category ?? existing.category,
      date ?? existing.date,
      note ?? existing.note,
      id,
      req.userId,
    ],
  })
  const updated = await db.execute({ sql: 'SELECT * FROM expenses WHERE id = ?', args: [id] })
  res.json(updated.rows[0])
})

app.delete('/api/expenses/:id', async (req, res) => {
  const { id } = req.params
  const existingResult = await db.execute({
    sql: 'SELECT * FROM expenses WHERE id = ? AND user_id = ?',
    args: [id, req.userId],
  })
  if (!existingResult.rows[0]) return res.status(404).json({ error: 'Expense not found' })

  await db.execute({
    sql: 'DELETE FROM expenses WHERE id = ? AND user_id = ?',
    args: [id, req.userId],
  })
  res.status(204).end()
})

app.use((err, req, res, next) => {
  console.error(`Request failed: ${req.method} ${req.originalUrl} — ${err.stack || err.message}`)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
