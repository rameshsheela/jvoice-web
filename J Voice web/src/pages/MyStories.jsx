import { newDocId } from '../store/firestoreData.js'
import { L, ltList } from '../i18n/localized.js'
import { useState } from 'react'
import { useSelectors, useStore, useToast } from '../store/store.jsx'
import { Empty, Modal, SectionHead, StatusPill, relativeTime } from '../components/ui.jsx'
import { NewsArticleEditor } from './News.jsx'
import { useMe } from './RoleDashboards.jsx'
import { NEWS_STATUS } from '../data/newsData.js'

/**
 * A reporter's own filings, and the only place in the console they can write.
 *
 * The list is scoped to `reporterId === me.id` rather than filtered in the view,
 * so there is no arrangement of the UI that shows one reporter another's copy.
 * Nothing here approves, publishes or edits after submission: once a story is in
 * the queue it belongs to an editor, and the reporter's remaining job is to read
 * what came back.
 */
export default function MyStories() {
  const { state, dispatch } = useStore()
  const s = useSelectors()
  const { notify } = useToast()
  const me = useMe()
  const [compose, setCompose] = useState(false)
  const [view, setView] = useState(null)

  if (!me) return null

  const mine = state.articles
    .filter((a) => a.reporterId === me.id)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  // A story an editor pushed back is the only kind that wants the reporter to do
  // something, so it is called out rather than left to be spotted in the list.
  const needsWork = mine.filter(
    (a) => a.status === NEWS_STATUS.SENT_BACK || a.status === NEWS_STATUS.REJECTED
  )

  return (
    <>
      <SectionHead
        title="Your filings"
        sub={mine.length ? mine.length + ' stor' + (mine.length === 1 ? 'y' : 'ies') + ' filed' : 'Nothing filed yet'}
      >
        <button className="primary" onClick={() => setCompose(true)}>File a story</button>
      </SectionHead>

      {needsWork.length ? (
        <div className="card card-pad" style={{ marginBottom: 14, borderColor: 'var(--warn)' }}>
          <div className="cell-title">
            {needsWork.length} stor{needsWork.length === 1 ? 'y' : 'ies'} came back from your editor
          </div>
          <div className="cell-sub">
            Open one to read the note, then file a corrected version.
          </div>
        </div>
      ) : null}

      {mine.length === 0 ? (
        <Empty
          title="No stories yet"
          description="File your first story and it goes to your editor's review queue."
          actionLabel="File a story"
          onAction={() => setCompose(true)}
        />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Headline</th>
                <th>Category</th>
                <th>Filed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((a) => (
                <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setView(a)}>
                  <td>
                    <div className="cell-title">{L(a.headline)}</div>
                    <div className="cell-sub">{L(a.shortDescription) || '—'}</div>
                  </td>
                  <td>{s.categoryName(a.categoryId)}</td>
                  <td>{relativeTime(a.createdAt)}</td>
                  <td><StatusPill status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {compose ? (
        <NewsArticleEditor
          filedBy={me}
          onClose={() => setCompose(false)}
          onSave={(fields) => {
            dispatch({ type: 'article/create', payload: { fields: { id: newDocId('articles'), ...fields } } })
            setCompose(false)
            notify(
              fields.status === NEWS_STATUS.SUBMITTED
                ? 'Filed — it is in your editor’s queue'
                : 'Saved as a draft — not sent to your editor yet'
            )
          }}
        />
      ) : null}

      {view ? (
        <Modal
          wide
          title={L(view.headline)}
          sub={s.categoryName(view.categoryId) + ' · ' + view.status}
          onClose={() => setView(null)}
          footer={<button onClick={() => setView(null)}>Close</button>}
        >
          {view.rejectionReason ? (
            <div className="kv">
              <span className="k">Why it was rejected</span>
              <span className="v">{L(view.rejectionReason)}</span>
            </div>
          ) : null}
          {view.editorNote ? (
            <div className="kv">
              <span className="k">Note from your editor</span>
              <span className="v">{L(view.editorNote)}</span>
            </div>
          ) : null}
          <div className="kv"><span className="k">Description</span><span className="v">{L(view.shortDescription) || '—'}</span></div>
          <div className="kv"><span className="k">Tags</span><span className="v">{ltList(view.tags || []).join(', ') || '—'}</span></div>
          {view.status === NEWS_STATUS.PUBLISHED ? (
            <div className="kv">
              <span className="k">Views</span>
              <span className="v">{(view.views || 0).toLocaleString('en-IN')}</span>
            </div>
          ) : null}
          <p className="article-body" style={{ marginTop: 14 }}>{L(view.content)}</p>
        </Modal>
      ) : null}
    </>
  )
}
