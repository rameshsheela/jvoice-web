import { L } from '../i18n/localized.js'
import { useNavigate } from 'react-router-dom'
import { useAuth, useSelectors, useStore } from '../store/store.jsx'
import { DemoNote, Empty, Pill, SectionHead, Stat, StatusPill, relativeTime } from '../components/ui.jsx'
import { NEWS_STATUS } from '../data/newsData.js'
import { CONTENT_STATUS } from '../data/studyData.js'
import { SHORT_STATUS } from '../data/shortsData.js'
import { CreatorDashboard, EditorDashboard, ReporterDashboard } from './RoleDashboards.jsx'

/** Each login lands on the dashboard built for what they actually do. */
export default function Dashboard() {
  const { isAdmin, isEditor, isCreator, isReporter } = useAuth()
  if (isEditor) return <EditorDashboard />
  if (isCreator) return <CreatorDashboard />
  if (isReporter) return <ReporterDashboard />
  if (isAdmin) return <AdminDashboard />
  return <AdminDashboard />
}

/** The full picture — both modules, the people running them, and the roles. */
function AdminDashboard() {
  const { state } = useStore()
  const s = useSelectors()
  const nav = useNavigate()
  const isAdmin = true

  const drafts = state.articles.filter((a) => a.status === NEWS_STATUS.DRAFT).length
  const rejected = state.articles.filter(
    (a) => a.status === NEWS_STATUS.REJECTED || a.status === NEWS_STATUS.SENT_BACK
  ).length
  const pendingContent = state.studyArticles.filter((a) => a.status === CONTENT_STATUS.PENDING_REVIEW)
  const shortsWaiting = state.shorts.filter(
    (sh) => sh.status === SHORT_STATUS.READY || sh.status === SHORT_STATUS.SCRIPT_READY
  )
  const activeExams = state.exams.filter((e) => e.isActive)

  const orphanReporters = state.users.filter(
    (u) => u.roles.includes('Reporter') && u.editorIds.length === 0
  )
  const orphanCreators = state.users.filter(
    (u) => u.roles.includes('Content Creator') && u.subjectIds.length === 0
  )
  const pendingPasswords = state.users.filter((u) => u.mustChangePassword)
  const emptyRoles = state.roles.filter(
    (r) => !state.users.some((u) => u.roles.includes(r.name))
  )

  const needsAttention = [
    orphanReporters.length && {
      label: 'Reporters with no editor',
      detail: orphanReporters.map((u) => u.name).join(', '),
      count: orphanReporters.length,
      tone: 'danger',
      to: '/news/reporters'
    },
    orphanCreators.length && {
      label: 'Creators with no subject',
      detail: orphanCreators.map((u) => u.name).join(', '),
      count: orphanCreators.length,
      tone: 'danger',
      to: '/study/creators'
    },
    s.reported.length && {
      label: 'Articles with reader reports',
      detail: 'Flagged by readers and not yet cleared',
      count: s.reported.length,
      tone: 'warn',
      to: '/news/articles'
    },
    pendingPasswords.length && {
      label: 'Logins yet to set a password',
      detail: pendingPasswords.map((u) => u.name).join(', '),
      count: pendingPasswords.length,
      tone: 'warn',
      to: '/system/users'
    },
    emptyRoles.length && {
      label: 'Roles nobody holds',
      detail: emptyRoles.map((r) => r.name).join(', '),
      count: emptyRoles.length,
      tone: 'muted',
      to: '/system/roles'
    }
  ].filter(Boolean)

  return (
    <>
      <DemoNote>
        Demo console — every action below changes local in-memory data only. Reloading the page restores the
        seed data.
      </DemoNote>

      <SectionHead title="News pipeline" sub="Module 1" />
      <div className="grid grid-4">
        <Stat
          label="Waiting on an editor"
          value={s.reviewQueue.length}
          caption="Submitted + under review"
          accent="var(--warn)"
          onClick={() => nav('/news/review')}
        />
        <Stat
          label="Published"
          value={s.published.length}
          caption={s.published.filter((a) => a.isBreaking).length + ' marked breaking'}
          accent="var(--ok)"
          onClick={isAdmin ? () => nav('/news/articles') : undefined}
        />
        <Stat
          label="Approved, not live"
          value={s.approvedNotLive.length}
          caption="Needs a publish"
          accent="var(--info)"
          onClick={isAdmin ? () => nav('/news/articles') : undefined}
        />
        <Stat
          label="Reader reports"
          value={s.reported.reduce((n, a) => n + (a.reportCount || 0), 0)}
          caption={s.reported.length + ' articles flagged'}
          accent="var(--danger)"
          onClick={isAdmin ? () => nav('/news/articles') : undefined}
        />
        <Stat label="Drafts with reporters" value={drafts} accent="var(--muted)" />
        <Stat label="Rejected / sent back" value={rejected} accent="var(--danger)" />
      </div>

      {isAdmin ? (
        <>
          <SectionHead title="Study & exams" sub="Module 2" />
          <div className="grid grid-4">
            <Stat
              label="Exam types"
              value={state.tracks.length}
              caption={state.tracks.filter((t) => t.isEnabled).length + ' visible to students'}
              accent="var(--brand)"
              onClick={() => nav('/study/exam-types')}
            />
            <Stat
              label="Subjects"
              value={state.subjects.length}
              caption={state.topics.length + ' topics'}
              onClick={() => nav('/study/subjects')}
            />
            <Stat
              label="Questions"
              value={state.questions.length}
              caption="In the bank"
              onClick={() => nav('/study/questions')}
            />
            <Stat
              label="Active tests"
              value={activeExams.length}
              caption={state.exams.length + ' total'}
              accent="var(--ok)"
              onClick={() => nav('/study/exams')}
            />
            <Stat
              label="Content awaiting review"
              value={pendingContent.length}
              accent="var(--warn)"
              onClick={() => nav('/study/content')}
            />
            <Stat
              label="Attempts recorded"
              value={state.results.length}
              caption="Across all exam types"
              onClick={() => nav('/study/results')}
            />
          </div>

          <SectionHead title="AI Shorts" sub="News to video pipeline" />
          <div className="grid grid-4">
            <Stat
              label="Waiting on approval"
              value={shortsWaiting.length}
              accent="var(--warn)"
              onClick={() => nav('/news/shorts')}
            />
            <Stat
              label="Published shorts"
              value={state.shorts.filter((sh) => sh.status === SHORT_STATUS.PUBLISHED).length}
              accent="var(--ok)"
              onClick={() => nav('/news/shorts')}
            />
            <Stat
              label="Failed renders"
              value={state.shorts.filter((sh) => sh.status === SHORT_STATUS.FAILED).length}
              accent="var(--danger)"
              onClick={() => nav('/news/shorts')}
            />
            <Stat
              label="Video templates"
              value={state.templates.filter((t) => t.isActive).length}
              caption={state.templates.length + ' configured'}
              onClick={() => nav('/news/shorts')}
            />
          </div>
        </>
      ) : null}

      <SectionHead title="People & access" sub="Who runs the platform" />
      <div className="grid grid-4">
        <Stat
          label="Reporters"
          value={state.users.filter((u) => u.roles.includes('Reporter')).length}
          caption={
            state.users.filter((u) => u.roles.includes('Reporter') && u.editorIds.length === 0).length +
            ' unassigned'
          }
          onClick={() => nav('/news/reporters')}
        />
        <Stat
          label="News editors"
          value={state.users.filter((u) => u.roles.includes('Editor')).length}
          caption="Own the review queue"
          onClick={() => nav('/news/editors')}
        />
        <Stat
          label="Content creators"
          value={state.users.filter((u) => u.roles.includes('Content Creator')).length}
          caption={
            state.users.filter((u) => u.roles.includes('Content Creator') && u.subjectIds.length === 0)
              .length + ' without a subject'
          }
          onClick={() => nav('/study/creators')}
        />
        <Stat
          label="Students"
          value={state.users.filter((u) => u.roles.includes('Student')).length}
          accent="var(--brand)"
          onClick={() => nav('/system/users')}
        />
        <Stat
          label="Multi-role logins"
          value={state.users.filter((u) => u.roles.length > 1).length}
          caption="Hold more than one hat"
          accent="var(--info)"
          onClick={() => nav('/system/users')}
        />
        <Stat
          label="Suspended"
          value={state.users.filter((u) => !u.isActive).length}
          accent="var(--danger)"
          onClick={() => nav('/system/users')}
        />
        <Stat
          label="Roles defined"
          value={state.roles.length}
          caption={state.roles.filter((r) => !r.isSystem).length + ' custom'}
          onClick={() => nav('/system/roles')}
        />
      </div>

      {needsAttention.length ? (
        <>
          <SectionHead title="Needs attention" sub="Gaps worth closing" />
          <div className="card table-wrap">
            <table>
              <tbody>
                {needsAttention.map((n) => (
                  <tr key={n.label} style={{ cursor: 'pointer' }} onClick={() => nav(n.to)}>
                    <td>
                      <div className="cell-title">{n.label}</div>
                      <div className="cell-sub">{n.detail}</div>
                    </td>
                    <td className="actions"><Pill tone={n.tone}>{n.count}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 22 }}>
        <div>
          <SectionHead title="Next in the queue" sub="Oldest submissions first" />
          {s.reviewQueue.length === 0 ? (
            <Empty title="Queue is clear" description="Nothing is waiting on an editor." />
          ) : (
            <div className="card table-wrap">
              <table>
                <tbody>
                  {s.reviewQueue.slice(0, 6).map((a) => (
                    <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => nav('/news/review')}>
                      <td>
                        <div className="cell-title">{L(a.headline)}</div>
                        <div className="cell-sub">
                          {s.categoryName(a.categoryId)} · {s.userName(a.reporterId)} ·{' '}
                          {relativeTime(a.createdAt)}
                        </div>
                      </td>
                      <td className="actions">
                        <StatusPill status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <SectionHead title="Recent actions" sub="This session" />
          <div className="card card-pad">
            {state.activity.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5 }}>
                Nothing yet — approve, publish or edit something and it will be listed here.
              </p>
            ) : (
              <ul className="plain activity">
                {state.activity.slice(0, 8).map((entry) => (
                  <li key={entry.id}>
                    <div>{entry.message}</div>
                    <time>{relativeTime(entry.at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
