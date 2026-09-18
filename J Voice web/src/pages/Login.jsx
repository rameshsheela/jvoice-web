import { Link, useNavigate } from 'react-router-dom'
import { JVoiceLogo } from '../components/Logo.jsx'
import { StaffSignInForm } from '../components/StaffSignIn.jsx'

/**
 * The console's sign-in screen, reached from the landing page's Login button
 * or directly at /login. Staff accounts only; there are no demo logins.
 */
export default function Login() {
  const navigate = useNavigate()
  const toConsole = () => navigate('/console', { replace: true })

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-head">
          <JVoiceLogo width={320} />
          <h1>Admin Console</h1>
          <p>
            For J Voice reporters, editors, content creators and admins. Sign in with your staff
            account to reach your dashboard.
          </p>
          <p style={{ marginTop: 10 }}>
            <Link to="/">← Back to jvoicetelugu.com</Link>
          </p>
        </div>

        <StaffSignInForm onSignedIn={toConsole} />
      </div>
    </div>
  )
}
