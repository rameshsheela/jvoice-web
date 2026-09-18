import { Link } from 'react-router-dom'
import { JVoiceLogo } from '../components/Logo.jsx'
import { useAuth } from '../store/store.jsx'

/**
 * The public landing page at `/` - a static front for J Voice.
 *
 * The news itself is read in the app; the website's job is to say what
 * J Voice is, point at the app, carry the privacy policy the store listing
 * links to, and give staff one way into the console. Shared stories still
 * open on the web at `/read/:id`, which is the one dynamic reader page kept.
 */
export default function Landing() {
  const { session } = useAuth()

  return (
    <main className="rd-main">
      <section className="ld-hero">
        <JVoiceLogo width={300} />
        <h1>
          తెలుగు వార్తలు, పోటీ పరీక్షల సన్నద్ధత
          <span className="ld-sub">Telugu news and competitive-exam preparation</span>
        </h1>
        <p className="ld-lead">
          Short, fast news from Telangana and Andhra Pradesh in Telugu and English, and
          exam preparation for Constable, SI, Group-1/2/4, SSC, RRB and more - all in the
          J Voice app.
        </p>
        <div className="ld-actions">
          <span className="ld-app">
            <strong>Get the app</strong>
            <span>Coming soon on Google Play</span>
          </span>
          {session ? (
            <Link className="rd-cta" to="/console">
              Open the console
            </Link>
          ) : (
            <Link className="rd-cta ld-login" to="/login">
              Login
            </Link>
          )}
        </div>
      </section>

      <section className="ld-grid">
        <div className="ld-card">
          <h3>📰 News</h3>
          <p>
            Every story in Telugu and English. Breaking news, your district, and the categories
            you follow - swipe through the day in minutes.
          </p>
        </div>
        <div className="ld-card">
          <h3>🎓 Study</h3>
          <p>
            Pick your exam and get its syllabus, topic quizzes, daily tests and grand tests, with
            results, rank and weak-area analysis.
          </p>
        </div>
        <div className="ld-card">
          <h3>🗣️ Your voice</h3>
          <p>
            Like, comment and reply on stories, and report anything that looks wrong straight to
            the editorial desk.
          </p>
        </div>
      </section>

      <p className="ld-foot">
        <Link to="/contact">Contact us</Link>
        <span className="ld-sep">·</span>
        <Link to="/privacy-policy">Privacy policy</Link>
      </p>
    </main>
  )
}
