import app from './app.js'

const PORT = 3001
app.listen(PORT, () => {
  console.log(`Expense tracker API running on http://localhost:${PORT}`)
})
