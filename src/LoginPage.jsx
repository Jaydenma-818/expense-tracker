import { useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from './firebase'
import { friendlyAuthError } from './authErrors'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleGoogleSignIn = async () => {
    setError(null)
    setInfo(null)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err) {
      setError(friendlyAuthError(err))
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    try {
      try {
        await signInWithEmailAndPassword(auth, email, password)
      } catch (signInErr) {
        const looksUnrecognized =
          signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential'
        if (!looksUnrecognized) throw signInErr

        try {
          await createUserWithEmailAndPassword(auth, email, password)
        } catch (signUpErr) {
          if (signUpErr.code === 'auth/email-already-in-use') throw signInErr
          throw signUpErr
        }
      }
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotPassword = async () => {
    setError(null)
    setInfo(null)
    if (!email) {
      setError('Enter your email above, then click "Forgot password?"')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email)
      setInfo('Password reset email sent — check your inbox.')
    } catch (err) {
      setError(friendlyAuthError(err))
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Daily Expense Tracker</h1>
        <p className="login-subtitle">Sign in to track your expenses</p>

        {error && <p className="status error">{error}</p>}
        {info && <p className="status info">{info}</p>}

        <button type="button" className="google-btn" onClick={handleGoogleSignIn}>
          Sign in with Google
        </button>

        <div className="divider">
          <span>or</span>
        </div>

        <form className="login-form" onSubmit={handleEmailSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Please wait...' : 'Continue'}
          </button>
        </form>

        <button type="button" className="link-btn" onClick={handleForgotPassword}>
          Forgot password?
        </button>
      </div>
    </div>
  )
}

export default LoginPage
