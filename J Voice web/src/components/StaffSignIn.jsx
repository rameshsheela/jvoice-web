import { useState } from 'react'
import { LOGIN_DOMAIN } from '../firebase.js'
import { useAuth } from '../store/store.jsx'

/**
 * The staff sign-in form.
 *
 * Lifted out of the Login page so the reader's landing page can carry the same
 * form at its foot without a second copy drifting from this one — two sign-in
 * forms that validate differently is exactly the bug this prevents.
 */
export function StaffSignInForm({ onSignedIn }) {
  const { signInStaff, firebaseReady } = useAuth()

  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signInStaff(loginId, password)
      // On success the provider swaps the session; the caller decides where to go.
      onSignedIn?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card staff-signin" onSubmit={submit}>
      <h3>Staff sign in</h3>
      <p className="cell-sub">Reporters, editors and the desk. Sign in with your J Voice login ID.</p>

      <label className="field">
        <span>Login ID</span>
        <span className="field-with-suffix">
          <input
            type="text"
            value={loginId}
            autoComplete="username"
            placeholder="your username"
            disabled={busy || !firebaseReady}
            onChange={(e) => setLoginId(e.target.value.trim())}
          />
          <span className="field-suffix">@{LOGIN_DOMAIN}</span>
        </span>
      </label>

      <label className="field">
        <span>Password</span>
        <span className="field-with-suffix">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            autoComplete="current-password"
            disabled={busy || !firebaseReady}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="ghost field-suffix-btn"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </span>
      </label>

      {error ? <div className="signin-error">{error}</div> : null}

      <button type="submit" className="primary block" disabled={busy || !firebaseReady || !loginId || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>

      {!firebaseReady ? <div className="signin-error">Firebase is not configured in this build.</div> : null}
    </form>
  )
}
