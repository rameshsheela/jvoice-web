import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { useAuth } from './store/store.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { Categories, Editors, NewsManagement, Reporters, ReviewQueue } from './pages/News.jsx'
import AiShorts from './pages/Shorts.jsx'
import { ContentCreators, ExamTypes, StudyContent, Subjects, Topics } from './pages/Study.jsx'
import { Exams, QuestionBank, Results } from './pages/Exams.jsx'
import { Settings, Users } from './pages/System.jsx'
import { Roles } from './pages/Roles.jsx'
import FeatureFlags from './pages/FeatureFlags.jsx'
import TopicWorkspace from './pages/TopicWorkspace.jsx'
import MyStories from './pages/MyStories.jsx'
import ExamTypeSyllabus from './pages/ExamTypeSyllabus.jsx'
import { ReaderArticle, ReaderShell } from './reader/Reader.jsx'
import Landing from './reader/Landing.jsx'
import PrivacyPolicy from './reader/PrivacyPolicy.jsx'
import Contact from './reader/Contact.jsx'

/**
 * Two applications behind one router.
 *
 *   `/`                a static landing page: what J Voice is, the app, and a
 *                      single Login button for staff
 *   `/read/:id`        a shared story, public - the one dynamic reader page
 *   `/privacy-policy`  the privacy policy, in the reader shell; the Play Store
 *                      listing links here
 *   `/contact`         address, phone and a message form that lands in Firestore
 *   `/login`           the console sign-in on its own
 *   everything else    the console, staff only
 *
 * The reader is the landing page deliberately: a visitor arriving at the domain
 * is a reader, not an editor, and the sign-in they may want is one scroll away.
 */

/** The console dashboard. The reader owns `/`, so this is where staff land. */
const HOME = '/console'

/**
 * Gate on the console.
 *
 * `authReady` matters: a Firebase session is restored asynchronously on reload,
 * and redirecting before it settles would bounce a signed-in admin out to the
 * login screen on every refresh.
 */
function RequireStaff({ children }) {
  const { session, authReady } = useAuth()
  if (!authReady) return null
  if (!session) return <Navigate to="/login" replace />
  return children
}

/** Admin-only routes fall back to the dashboard for every other login. */
function AdminOnly({ children }) {
  const { isAdmin } = useAuth()
  return isAdmin ? children : <Navigate to={HOME} replace />
}

/** Open to the Admin plus whichever roles are named. */
function Allow({ roles, children }) {
  const { session } = useAuth()
  return session.role === 'Admin' || roles.includes(session.role) ? children : <Navigate to={HOME} replace />
}

export default function App() {
  const { session } = useAuth()

  return (
    <Routes>
      {/* ---------------------------------------------------- reader (public) */}
      <Route element={<ReaderShell />}>
        <Route path="/" element={<Landing />} />
        <Route path="/read/:id" element={<ReaderArticle />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/contact" element={<Contact />} />
      </Route>

      {/* Signing in again while signed in is a dead end; go to the console. */}
      <Route path="/login" element={session ? <Navigate to={HOME} replace /> : <Login />} />

      {/* --------------------------------------------------- console (staff) */}
      <Route
        element={
          <RequireStaff>
            <Layout />
          </RequireStaff>
        }
      >
        <Route path={HOME} element={<Dashboard />} />

        {/* news — the Editor shares the review queue with the Admin */}
        {/* A reporter's own filings. Admin is allowed in by `Allow` so support
            can see what a reporter sees; nobody else has a reason to. */}
        <Route
          path="/news/mine"
          element={
            <Allow roles={['Reporter']}>
              <MyStories />
            </Allow>
          }
        />
        {/* Guarded explicitly, not by absence from the sidebar. Until reporters
            could sign in, every persona that existed was allowed here and the
            bare route was harmless; a reporter reaching it by URL would be able
            to approve and publish their own copy. `Allow` admits the Admin. */}
        <Route
          path="/news/review"
          element={
            <Allow roles={['Editor']}>
              <ReviewQueue />
            </Allow>
          }
        />
        <Route path="/news/articles" element={<AdminOnly><NewsManagement /></AdminOnly>} />
        <Route path="/news/categories" element={<AdminOnly><Categories /></AdminOnly>} />
        <Route path="/news/reporters" element={<AdminOnly><Reporters /></AdminOnly>} />
        <Route path="/news/editors" element={<AdminOnly><Editors /></AdminOnly>} />
        <Route path="/news/shorts" element={<AdminOnly><AiShorts /></AdminOnly>} />

        {/* study */}
        <Route path="/study/exam-types" element={<AdminOnly><ExamTypes /></AdminOnly>} />
        <Route
          path="/study/exam-type/:trackId"
          element={
            <Allow roles={['Content Creator']}>
              <ExamTypeSyllabus />
            </Allow>
          }
        />
        <Route path="/study/subjects" element={<AdminOnly><Subjects /></AdminOnly>} />
        <Route path="/study/topics" element={<AdminOnly><Topics /></AdminOnly>} />
        <Route
          path="/study/topic/:topicId"
          element={
            <Allow roles={['Content Creator']}>
              <TopicWorkspace />
            </Allow>
          }
        />
        <Route
          path="/study/content"
          element={
            <Allow roles={['Content Creator']}>
              <StudyContent />
            </Allow>
          }
        />
        <Route
          path="/study/questions"
          element={
            <Allow roles={['Content Creator']}>
              <QuestionBank />
            </Allow>
          }
        />
        <Route path="/study/exams" element={<AdminOnly><Exams /></AdminOnly>} />
        <Route path="/study/results" element={<AdminOnly><Results /></AdminOnly>} />
        <Route path="/study/creators" element={<AdminOnly><ContentCreators /></AdminOnly>} />

        {/* system */}
        <Route path="/system/users" element={<AdminOnly><Users /></AdminOnly>} />
        <Route path="/system/roles" element={<AdminOnly><Roles /></AdminOnly>} />
        <Route path="/system/settings" element={<AdminOnly><Settings /></AdminOnly>} />
        <Route path="/system/flags" element={<AdminOnly><FeatureFlags /></AdminOnly>} />
      </Route>

      {/* An unknown path belongs to the reader, not the console. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
