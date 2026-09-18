import { L } from '../i18n/localized.js'
import { useNavigate } from 'react-router-dom'
import { useAuth, useSelectors, useStore } from '../store/store.jsx'
import { Bar, Empty, Pill, SectionHead, Stat, StatusPill, relativeTime } from '../components/ui.jsx'
import { NEWS_STATUS } from '../data/newsData.js'
import { CONTENT_STATUS } from '../data/studyData.js'

/* ------------------------------------------------------------------ shared */

/**
 * The signed-in login's own account record — assignments hang off this.
 *
 * A demo persona carries `userId` and matches directly. A real Firebase sign-in
 * does not: it knows the account by login id and email, so those are tried next.
 * Without the fallback every role dashboard renders blank for a real sign-in,
 * because `me` is what they are all built on.
 */
export function useMe() {
  const { state } = useStore()
  const { session } = useAuth()
  if (!session) return null
  return (
    state.users.find((u) => u.id === session.userId) ||
    state.users.find((u) => session.loginId && u.username === session.loginId) ||
    state.users.find((u) => session.email && u.email === session.email) ||
    null
  )
}

function Greeting({ me, line }) {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return (
    <div className="card card-pad greeting">
      <div>
        <h2>{part}, {me.name.split(' ')[0]}</h2>
        <div className="cell-sub">{line}</div>
      </div>
      <div className="tag-row">
        {me.roles.map((r) => <span className="tag alt" key={r}>{r}</span>)}
      </div>
    </div>
  )
}

/** A worklist card — the "here is what to do next" block on every dashboard. */
function WorkList({ title, sub, items, empty, onOpen, render }) {
  return (
    <div>
      <SectionHead title={title} sub={sub} />
      {items.length === 0 ? (
        <Empty title={empty.title} description={empty.description} />
      ) : (
        <div className="card table-wrap">
          <table>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(item)}>
                  {render(item)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ news editor */

/**
 * The news editor's desk. Everything is scoped to what they own — their
 * reporters and their sections — with the shared queue kept separate so
 * nothing silently goes unclaimed.
 */
export function EditorDashboard() {
  const { state } = useStore()
  const s = useSelectors()
  const nav = useNavigate()
  const me = useMe()
  if (!me) return null

  const myReporters = state.users.filter(
    (u) => u.roles.includes('Reporter') && u.editorIds.includes(me.id)
  )
  const myReporterIds = myReporters.map((r) => r.id)

  // a story I filed myself never lands in my own review list
  const queue = s.reviewQueue.filter((a) => a.reporterId !== me.id)
  const mine = queue.filter((a) => myReporterIds.includes(a.reporterId))
  const mySections = queue.filter(
    (a) => !myReporterIds.includes(a.reporterId) && me.sectionIds.includes(a.categoryId)
  )
  const unclaimed = queue.filter(
    (a) => !myReporterIds.includes(a.reporterId) && !me.sectionIds.includes(a.categoryId)
  )

  const published = s.published.filter((a) => myReporterIds.includes(a.reporterId))
  const sentBack = state.articles.filter(
    (a) =>
      myReporterIds.includes(a.reporterId) &&
      (a.status === NEWS_STATUS.SENT_BACK || a.status === NEWS_STATUS.REJECTED)
  )
  const iFiled = state.articles.filter((a) => a.reporterId === me.id)

  return (
    <>
      <Greeting
        me={me}
        line={
          mine.length
            ? mine.length + ' stor' + (mine.length === 1 ? 'y' : 'ies') + ' from your reporters need you.'
            : 'Your reporters have nothing waiting. Nice.'
        }
      />

      <SectionHead title="Your desk" sub="Scoped to your reporters and sections" />
      <div className="grid grid-4">
        <Stat
          label="From your reporters"
          value={mine.length}
          caption="Waiting on you"
          accent="var(--warn)"
          onClick={() => nav('/news/review')}
        />
        <Stat
          label="In your sections"
          value={mySections.length}
          caption="Not one of yours, but your beat"
          accent="var(--info)"
          onClick={() => nav('/news/review')}
        />
        <Stat
          label="Unclaimed"
          value={unclaimed.length}
          caption="Nobody owns these yet"
          accent={unclaimed.length ? 'var(--danger)' : 'var(--muted)'}
          onClick={() => nav('/news/review')}
        />
        <Stat
          label="Your reporters"
          value={myReporters.length}
          caption={myReporters.filter((r) => r.isActive).length + ' active'}
        />
        <Stat label="Published from your desk" value={published.length} accent="var(--ok)" />
        <Stat label="Sent back / rejected" value={sentBack.length} accent="var(--danger)" />
      </div>

      {me.roles.includes('Reporter') ? (
        <>
          <SectionHead title="Your own copy" sub="You also file stories — these are yours" />
          <div className="grid grid-4">
            <Stat label="Filed by you" value={iFiled.length} />
            <Stat
              label="Yours published"
              value={iFiled.filter((a) => a.status === NEWS_STATUS.PUBLISHED).length}
              accent="var(--ok)"
            />
            <Stat
              label="Yours in review"
              value={
                iFiled.filter(
                  (a) =>
                    a.status === NEWS_STATUS.SUBMITTED || a.status === NEWS_STATUS.UNDER_REVIEW
                ).length
              }
              caption="Another editor clears these"
              accent="var(--warn)"
            />
            <Stat label="Your beats" value={me.beatIds.length} />
          </div>
        </>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 22 }}>
        <WorkList
          title="Next from your reporters"
          sub="Oldest first"
          items={mine.slice(0, 6)}
          empty={{ title: 'Nothing from your reporters', description: 'Their queue is clear.' }}
          onOpen={() => nav('/news/review')}
          render={(a) => (
            <>
              <td>
                <div className="cell-title">{L(a.headline)}</div>
                <div className="cell-sub">
                  {s.categoryName(a.categoryId)} · {s.userName(a.reporterId)} ·{' '}
                  {relativeTime(a.createdAt)}
                </div>
              </td>
              <td className="actions"><StatusPill status={a.status} /></td>
            </>
          )}
        />

        <div>
          <SectionHead title="Your reporters" sub="Output at a glance" />
          {myReporters.length === 0 ? (
            <Empty
              title="No reporters assigned"
              description="An admin assigns reporters to you from the Editors page."
            />
          ) : (
            <div className="card table-wrap">
              <table>
                <tbody>
                  {myReporters.map((r) => {
                    const filed = state.articles.filter((a) => a.reporterId === r.id)
                    const live = filed.filter((a) => a.status === NEWS_STATUS.PUBLISHED).length
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="cell-title">{r.name}</div>
                          <div className="cell-sub">
                            {r.beatIds.map(s.categoryName).join(', ') || 'No beat'}
                          </div>
                        </td>
                        <td className="num">
                          <div className="cell-title">{filed.length}</div>
                          <div className="cell-sub">{live} live</div>
                        </td>
                        <td className="actions">
                          {r.isActive ? null : <Pill tone="danger">Suspended</Pill>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* -------------------------------------------------------- content creator */

/** A writer's view: what I owe, what came back, and how my work is landing. */
export function CreatorDashboard() {
  const { state } = useStore()
  const s = useSelectors()
  const nav = useNavigate()
  const me = useMe()
  if (!me) return null

  const mine = state.studyArticles.filter((a) => a.authorName === me.name)
  const drafts = mine.filter((a) => a.status === CONTENT_STATUS.DRAFT)
  const inReview = mine.filter((a) => a.status === CONTENT_STATUS.PENDING_REVIEW)
  const live = mine.filter((a) => a.status === CONTENT_STATUS.PUBLISHED)
  const myQuestions = state.questions.filter((q) => me.subjectIds.includes(q.subjectId))
  // subjects they own, and how much of each is still unwritten
  const myTopics = me.subjectIds.flatMap((id) => s.topicsOf(id))
  const bareTopics = myTopics.filter(
    (t) => !state.studyArticles.some((a) => a.topicId === t.id)
  )

  const publishedRate = mine.length ? Math.round((live.length * 100) / mine.length) : 0

  return (
    <>
      <Greeting
        me={me}
        line={
          drafts.length
            ? drafts.length + ' draft(s) still to finish and publish.'
            : bareTopics.length
              ? bareTopics.length + ' of your topics still have nothing written.'
              : 'Every topic you own has material. Nice.'
        }
      />

      <SectionHead title="Your work" sub="Study material you have written" />
      <div className="grid grid-4">
        <Stat
          label="Drafts"
          value={drafts.length}
          caption="Not submitted yet"
          accent="var(--muted)"
          onClick={() => nav('/study/content')}
        />
        <Stat
          label="Awaiting review"
          value={inReview.length}
          caption="Submitted, not yet published"
          accent="var(--warn)"
          onClick={() => nav('/study/content')}
        />
        <Stat
          label="Published"
          value={live.length}
          caption="Live for students"
          accent="var(--ok)"
          onClick={() => nav('/study/content')}
        />
        <Stat
          label="Questions in your subjects"
          value={myQuestions.length}
          onClick={() => nav('/study/questions')}
        />
      </div>

      <div className="card card-pad" style={{ marginTop: 14 }}>
        <div className="btn-row" style={{ marginBottom: 8, alignItems: 'center' }}>
          <div className="cell-title">Published rate</div>
          <span style={{ flex: 1 }} />
          <span className="cell-sub">{live.length} of {mine.length} pieces are live</span>
        </div>
        <Bar percent={publishedRate} tone={publishedRate >= 60 ? 'ok' : 'warn'} />
      </div>

      <div className="grid grid-2" style={{ marginTop: 22 }}>
        <WorkList
          title="Your pieces"
          sub="Newest first"
          items={mine.slice(0, 7)}
          empty={{
            title: 'Nothing written yet',
            description: 'Head to Study material to write your first piece.'
          }}
          onOpen={() => nav('/study/content')}
          render={(a) => (
            <>
              <td>
                <div className="cell-title">{a.title}</div>
                <div className="cell-sub">
                  {s.subjectEmoji(a.subjectId)} {s.subjectName(a.subjectId)} ·{' '}
                  {a.readingMinutes} min read · {relativeTime(a.createdAt)}
                </div>
              </td>
              <td className="actions"><StatusPill status={a.status} /></td>
            </>
          )}
        />

        <div>
          <SectionHead title="Your assignment" sub="What you are set up to write" />
          <div className="card card-pad">
            <div className="kv">
              <span className="k">Subjects</span>
              <span className="v">
                {me.subjectIds.length ? (
                  <div className="tag-row">
                    {me.subjectIds.map((id) => (
                      <span className="tag" key={id}>
                        {s.subjectEmoji(id)} {s.subjectName(id)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <Pill tone="danger">None assigned</Pill>
                )}
              </span>
            </div>
            <div className="kv">
              <span className="k">Exam types</span>
              <span className="v">
                {me.trackIds.length ? (
                  <div className="tag-row">
                    {me.trackIds.map((id) => (
                      <span className="tag" key={id}>{s.trackName(id)}</span>
                    ))}
                  </div>
                ) : (
                  'All exam types'
                )}
              </span>
            </div>
            <div className="kv">
              <span className="k">Topics to cover</span>
              <span className="v">
                {myTopics.length} across your subjects
                {bareTopics.length ? (
                  <div className="cell-sub">{bareTopics.length} still empty</div>
                ) : null}
              </span>
            </div>
          </div>

          <SectionHead title="Topics with nothing written" sub="Open one and start it" />
          {bareTopics.length === 0 ? (
            <Empty title="All covered" description="Every topic in your subjects has material." />
          ) : (
            <div className="card table-wrap">
              <table>
                <tbody>
                  {bareTopics.slice(0, 6).map((t) => (
                    <tr
                      key={t.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => nav('/study/topic/' + t.id)}
                    >
                      <td>
                        <div className="cell-title">{L(t.name)}</div>
                        <div className="cell-sub">
                          {s.subjectEmoji(t.subjectId)} {s.subjectName(t.subjectId)} · {t.difficulty}
                        </div>
                      </td>
                      <td className="actions">
                        <Pill tone="danger">empty</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- reporter */

/**
 * The reporter's desk. Deliberately the smallest dashboard in the console: a
 * reporter's whole relationship with it is "what did I file, and what happened
 * to it". Anything an editor decides is absent rather than disabled, so there is
 * nothing here to discover and be refused.
 */
export function ReporterDashboard() {
  const { state } = useStore()
  const s = useSelectors()
  const nav = useNavigate()
  const me = useMe()
  if (!me) return null

  const mine = state.articles.filter((a) => a.reporterId === me.id)
  const drafts = mine.filter((a) => a.status === NEWS_STATUS.DRAFT)
  const waiting = mine.filter(
    (a) => a.status === NEWS_STATUS.SUBMITTED || a.status === NEWS_STATUS.UNDER_REVIEW
  )
  const back = mine.filter(
    (a) => a.status === NEWS_STATUS.SENT_BACK || a.status === NEWS_STATUS.REJECTED
  )
  const live = mine.filter((a) => a.status === NEWS_STATUS.PUBLISHED)
  const reads = live.reduce((n, a) => n + (a.views || 0), 0)
  const myEditors = (me.editorIds || []).map((id) => s.userName(id)).filter(Boolean)

  return (
    <>
      <Greeting
        me={me}
        line={
          back.length
            ? back.length + ' stor(y/ies) came back from your editor.'
            : waiting.length
              ? waiting.length + ' filed and waiting on the desk.'
              : 'Nothing pending. File something.'
        }
      />

      <SectionHead title="Your filings" sub="Every story you have filed">
        <button className="primary" onClick={() => nav('/news/mine')}>File a story</button>
      </SectionHead>
      <div className="grid grid-4">
        <Stat
          label="Drafts"
          value={drafts.length}
          caption="Not sent to your editor"
          accent="var(--muted)"
          onClick={() => nav('/news/mine')}
        />
        <Stat
          label="With the desk"
          value={waiting.length}
          caption="Filed, awaiting a decision"
          accent="var(--warn)"
          onClick={() => nav('/news/mine')}
        />
        <Stat
          label="Came back"
          value={back.length}
          caption="Rejected or sent back to you"
          accent="var(--danger, var(--warn))"
          onClick={() => nav('/news/mine')}
        />
        <Stat
          label="Published"
          value={live.length}
          caption={reads.toLocaleString('en-IN') + ' reads'}
          accent="var(--ok)"
          onClick={() => nav('/news/mine')}
        />
      </div>

      <div className="grid grid-2" style={{ marginTop: 22 }}>
        <WorkList
          title="Needs your attention"
          sub="Your editor sent these back"
          items={back.slice(0, 6)}
          empty={{ title: 'Nothing came back', description: 'No story of yours was rejected or sent back.' }}
          onOpen={() => nav('/news/mine')}
          render={(a) => (
            <>
              <td>
                <div className="cell-title">{L(a.headline)}</div>
                <div className="cell-sub">{a.rejectionReason || a.editorNote || 'Open to read the note'}</div>
              </td>
              <td><StatusPill status={a.status} /></td>
            </>
          )}
        />
        <WorkList
          title="Recently filed"
          sub="Your latest stories"
          items={[...mine].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6)}
          empty={{ title: 'Nothing filed yet', description: 'Your filings will appear here.' }}
          onOpen={() => nav('/news/mine')}
          render={(a) => (
            <>
              <td>
                <div className="cell-title">{L(a.headline)}</div>
                <div className="cell-sub">{s.categoryName(a.categoryId)} · {relativeTime(a.createdAt)}</div>
              </td>
              <td><StatusPill status={a.status} /></td>
            </>
          )}
        />
      </div>

      {myEditors.length ? (
        <div className="card card-pad" style={{ marginTop: 22 }}>
          <div className="cell-title">Your editor{myEditors.length > 1 ? 's' : ''}</div>
          <div className="cell-sub">
            {myEditors.join(', ')} review{myEditors.length > 1 ? '' : 's'} what you file.
          </div>
        </div>
      ) : (
        <div className="card card-pad" style={{ marginTop: 22 }}>
          <div className="cell-title">No editor assigned</div>
          <div className="cell-sub">
            You can still file, but nobody owns your queue yet — ask an admin to assign you an editor.
          </div>
        </div>
      )}
    </>
  )
}
