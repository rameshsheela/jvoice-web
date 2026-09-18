import { L } from '../i18n/localized.js'
import { useState } from 'react'
import { useSelectors, useStore, useToast } from '../store/store.jsx'
import {
  Chips, Confirm, DemoNote, Empty, Field, Modal, Pill, SectionHead, Stat, StatusPill, Switch, relativeTime
} from '../components/ui.jsx'
import { LANGUAGES, SHORT_STATUS, voices } from '../data/shortsData.js'
import { NEWS_STATUS } from '../data/newsData.js'

const FILTERS = ['All', SHORT_STATUS.DRAFT, SHORT_STATUS.SCRIPT_READY, SHORT_STATUS.READY, SHORT_STATUS.APPROVED, SHORT_STATUS.PUBLISHED, SHORT_STATUS.FAILED]

export default function AiShorts() {
  const { state, dispatch } = useStore()
  const s = useSelectors()
  const { notify } = useToast()
  const [filter, setFilter] = useState('All')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [remove, setRemove] = useState(null)

  const rows = state.shorts.filter((sh) => filter === 'All' || sh.status === filter)
  const templateName = (id) => state.templates.find((t) => t.id === id)?.name || '—'
  const voiceName = (id) => voices.find((v) => v.id === id)?.name || '—'

  const setStatus = (short, status, message) => {
    dispatch({ type: 'short/setStatus', payload: { id: short.id, status, title: short.title } })
    notify(message)
  }

  return (
    <>
      <DemoNote>
        The generation steps are simulated — no AI call, no rendering. Script, voice, media and render all move
        the short through the same states the app shows.
      </DemoNote>

      <div className="grid grid-4">
        <Stat label="Shorts" value={state.shorts.length} />
        <Stat
          label="Waiting on approval"
          value={state.shorts.filter((sh) => sh.status === SHORT_STATUS.READY).length}
          accent="var(--warn)"
        />
        <Stat
          label="Published"
          value={state.shorts.filter((sh) => sh.status === SHORT_STATUS.PUBLISHED).length}
          accent="var(--ok)"
        />
        <Stat
          label="Failed"
          value={state.shorts.filter((sh) => sh.status === SHORT_STATUS.FAILED).length}
          accent="var(--danger)"
        />
      </div>

      <SectionHead title="Shorts" sub="News stories turned into video">
        <button className="primary" onClick={() => setCreating(true)}>New short from a story</button>
      </SectionHead>
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <Chips options={FILTERS} value={filter} onToggle={setFilter} multi={false} />
      </div>

      {rows.length === 0 ? (
        <Empty title="No shorts here" description="Change the filter, or draft one from a published story." />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Short</th>
                <th>Source story</th>
                <th>Template / voice</th>
                <th>Status</th>
                <th className="num">Views</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((sh) => (
                <tr key={sh.id}>
                  <td style={{ maxWidth: 300 }}>
                    <div className="cell-title">{sh.title}</div>
                    <div className="cell-sub">
                      {sh.scenes.length} scenes · {sh.durationSeconds}s · {sh.language} · {relativeTime(sh.createdAt)}
                    </div>
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <div className="cell-sub">{L(s.articleById(sh.newsId)?.headline) || 'Story removed'}</div>
                  </td>
                  <td>
                    <div className="cell-title">{templateName(sh.templateId)}</div>
                    <div className="cell-sub">{voiceName(sh.voiceId)}</div>
                  </td>
                  <td>
                    <StatusPill status={sh.status} />
                    {sh.failureReason ? <div className="cell-sub">{sh.failureReason}</div> : null}
                  </td>
                  <td className="num">{sh.views.toLocaleString('en-IN')}</td>
                  <td className="actions">
                    <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                      <button className="small ghost" onClick={() => setEditing(sh)}>Open</button>
                      {sh.status === SHORT_STATUS.DRAFT ? (
                        <button
                          className="small primary"
                          onClick={() => {
                            const article = s.articleById(sh.newsId)
                            dispatch({
                              type: 'short/generateScript',
                              payload: {
                                id: sh.id,
                                title: sh.title,
                                headline: L(article?.headline) || sh.title,
                                description: L(article?.shortDescription)
                              }
                            })
                            notify('Script generated')
                          }}
                        >
                          Generate script
                        </button>
                      ) : null}
                      {sh.status === SHORT_STATUS.SCRIPT_READY ? (
                        <button
                          className="small primary"
                          onClick={() => setStatus(sh, SHORT_STATUS.READY, 'Render finished — ready for review')}
                        >
                          Render
                        </button>
                      ) : null}
                      {sh.status === SHORT_STATUS.READY ? (
                        <button className="small primary" onClick={() => setStatus(sh, SHORT_STATUS.APPROVED, 'Short approved')}>
                          Approve
                        </button>
                      ) : null}
                      {sh.status === SHORT_STATUS.APPROVED ? (
                        <button className="small primary" onClick={() => setStatus(sh, SHORT_STATUS.PUBLISHED, 'Short published to Clips')}>
                          Publish
                        </button>
                      ) : null}
                      {sh.status === SHORT_STATUS.PUBLISHED ? (
                        <button className="small" onClick={() => setStatus(sh, SHORT_STATUS.APPROVED, 'Short unpublished')}>
                          Unpublish
                        </button>
                      ) : null}
                      {sh.status === SHORT_STATUS.FAILED ? (
                        <button className="small primary" onClick={() => setStatus(sh, SHORT_STATUS.SCRIPT_READY, 'Regenerating from the script')}>
                          Retry
                        </button>
                      ) : null}
                      <button className="small danger" onClick={() => setRemove(sh)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SectionHead title="Video templates" sub="What the generator can use" />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Template</th>
              <th>Category</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {state.templates.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="cell-title">
                    {t.name} {t.isDefault ? <Pill tone="info">Default</Pill> : null}
                  </div>
                  <div className="cell-sub">{t.description}</div>
                </td>
                <td>{t.category}</td>
                <td>
                  <Switch
                    checked={t.isActive}
                    onChange={() => {
                      dispatch({ type: 'template/toggle', payload: { id: t.id, name: t.name } })
                      notify(t.name + (t.isActive ? ' disabled' : ' enabled'))
                    }}
                  />
                </td>
                <td className="actions">
                  <button
                    className="small"
                    disabled={t.isDefault || !t.isActive}
                    onClick={() => {
                      dispatch({ type: 'template/setDefault', payload: { id: t.id, name: t.name } })
                      notify(t.name + ' is now the default')
                    }}
                  >
                    Make default
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating ? (
        <NewShortDialog
          onClose={() => setCreating(false)}
          onCreate={(article) => {
            dispatch({
              type: 'short/create',
              payload: { newsId: article.id, title: L(article.headline), by: 'Ravi Teja Sharma' }
            })
            setCreating(false)
            notify('Draft short created')
          }}
        />
      ) : null}

      {editing ? (
        <ShortEditor
          short={state.shorts.find((sh) => sh.id === editing.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {remove ? (
        <Confirm
          title="Delete this short?"
          message={'"' + remove.title + '" is removed from the Clips feed.'}
          confirmLabel="Delete"
          danger
          onClose={() => setRemove(null)}
          onConfirm={() => {
            dispatch({ type: 'short/delete', payload: { id: remove.id, title: remove.title } })
            setRemove(null)
            notify('Short deleted')
          }}
        />
      ) : null}
    </>
  )
}

function NewShortDialog({ onClose, onCreate }) {
  const { state } = useStore()
  const s = useSelectors()
  const published = state.articles.filter((a) => a.status === NEWS_STATUS.PUBLISHED)

  return (
    <Modal title="Draft a short" sub="Pick the published story to turn into video" onClose={onClose}
      footer={<button onClick={onClose}>Cancel</button>}>
      <div className="table-wrap">
        <table>
          <tbody>
            {published.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="cell-title">{L(a.headline)}</div>
                  <div className="cell-sub">{s.categoryName(a.categoryId)} · {relativeTime(a.createdAt)}</div>
                </td>
                <td className="actions">
                  <button className="small primary" onClick={() => onCreate(a)}>Use this</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

function ShortEditor({ short, onClose }) {
  const { state, dispatch } = useStore()
  const { notify } = useToast()
  if (!short) return null

  const update = (fields) => dispatch({ type: 'short/update', payload: { id: short.id, fields } })

  return (
    <Modal
      wide
      title={short.title}
      sub={short.status + ' · ' + short.scenes.length + ' scenes · ' + short.durationSeconds + 's'}
      onClose={onClose}
      footer={<button className="primary" onClick={onClose}>Done</button>}
    >
      <div className="form-row">
        <Field label="Template">
          <select value={short.templateId} onChange={(e) => update({ templateId: e.target.value })}>
            {state.templates.filter((t) => t.isActive).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Language">
          <select
            value={short.language}
            onChange={(e) => update({ language: e.target.value })}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.label} disabled={!l.available}>
                {l.label}{l.available ? '' : ' (not available)'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Voice">
          <select value={short.voiceId} onChange={(e) => update({ voiceId: e.target.value })}>
            {voices.filter((v) => v.language === short.language).map((v) => (
              <option key={v.id} value={v.id}>{v.name} · {v.gender}</option>
            ))}
          </select>
        </Field>
        <Field label="Total duration (seconds)">
          <input
            type="number"
            value={short.durationSeconds}
            onChange={(e) => update({ durationSeconds: Number(e.target.value) || 0 })}
          />
        </Field>
      </div>

      <SectionHead title="Scenes" sub="Text, length and the media assigned to each">
        <button className="small" onClick={() => dispatch({ type: 'short/addScene', payload: { id: short.id } })}>
          Add scene
        </button>
      </SectionHead>

      {short.scenes.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
          No script yet. Close this and use <strong>Generate script</strong>.
        </p>
      ) : (
        short.scenes.map((sc, i) => (
          <div className="scene-row" key={sc.id}>
            <div className="idx">{i + 1}</div>
            <div style={{ flex: 1 }}>
              <textarea
                style={{ minHeight: 56 }}
                value={sc.text}
                onChange={(e) =>
                  dispatch({
                    type: 'short/updateScene',
                    payload: { id: short.id, sceneId: sc.id, fields: { text: e.target.value } }
                  })
                }
              />
              <div className="btn-row" style={{ marginTop: 6 }}>
                <span className="cell-sub">{sc.mediaLabel}</span>
                <input
                  type="number"
                  style={{ width: 90 }}
                  value={sc.seconds}
                  onChange={(e) =>
                    dispatch({
                      type: 'short/updateScene',
                      payload: { id: short.id, sceneId: sc.id, fields: { seconds: Number(e.target.value) || 0 } }
                    })
                  }
                />
                <button
                  className="small ghost"
                  onClick={() => {
                    dispatch({
                      type: 'short/updateScene',
                      payload: {
                        id: short.id,
                        sceneId: sc.id,
                        fields: { mediaLabel: 'Re-suggested clip ' + Math.floor(Math.random() * 90 + 10) }
                      }
                    })
                    notify('Media re-suggested')
                  }}
                >
                  Re-suggest media
                </button>
                <button
                  className="small danger"
                  onClick={() => dispatch({ type: 'short/deleteScene', payload: { id: short.id, sceneId: sc.id } })}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </Modal>
  )
}
