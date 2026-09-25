import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import LoginPage from './LoginPage'
import './App.css'

const API_URL = '/api/expenses'

const emptyForm = { amount: '', category: '', date: '', note: '' }

async function authFetch(url, options = {}) {
  const token = await auth.currentUser.getIdToken()
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
}

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
    })
  }, [])

  const loadExpenses = () => {
    setLoading(true)
    setError(null)
    return authFetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load expenses (${res.status})`)
        return res.json()
      })
      .then((data) => setExpenses(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user) loadExpenses()
  }, [user])

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.amount || !form.category || !form.date) return

    setSaving(true)
    setError(null)
    try {
      const url = editingId ? `${API_URL}/${editingId}` : API_URL
      const method = editingId ? 'PUT' : 'POST'
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(`Failed to save expense (${res.status})`)
      resetForm()
      await loadExpenses()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (expense) => {
    setEditingId(expense.id)
    setForm({
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
      note: expense.note,
    })
  }

  const handleDelete = async (id) => {
    setError(null)
    try {
      const res = await authFetch(`${API_URL}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Failed to delete expense (${res.status})`)
      if (editingId === id) resetForm()
      await loadExpenses()
    } catch (err) {
      setError(err.message)
    }
  }

  if (authLoading) return <p className="status">Loading...</p>
  if (!user) return <LoginPage />

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Daily Expense Tracker</h1>
          <p className="user-info">{user.displayName || user.email}</p>
        </div>
        <button type="button" className="secondary" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </header>

      {error && <p className="status error">Error: {error}</p>}

      <div className="total">
        <span>Total</span>
        <strong>${total.toFixed(2)}</strong>
      </div>

      <form className="expense-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <input
            type="number"
            step="0.01"
            name="amount"
            placeholder="Amount"
            value={form.amount}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="category"
            placeholder="Category"
            value={form.category}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-row">
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="note"
            placeholder="Note"
            value={form.note}
            onChange={handleChange}
          />
        </div>
        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {editingId ? 'Save changes' : 'Add expense'}
          </button>
          {editingId && (
            <button type="button" className="secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading && <p className="status">Loading expenses...</p>}

      {!loading && (
        <ul className="expense-list">
          {expenses.map((expense) => (
            <li key={expense.id} className="expense-item">
              <div className="expense-main">
                <span className="expense-category">{expense.category}</span>
                <span className="expense-amount">${expense.amount.toFixed(2)}</span>
              </div>
              <div className="expense-meta">
                <span className="expense-date">{expense.date}</span>
                <span className="expense-note">{expense.note}</span>
              </div>
              <div className="expense-actions">
                <button type="button" onClick={() => handleEdit(expense)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDelete(expense.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
