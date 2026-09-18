/**
 * The app-level feature flags screen.
 *
 * Distinct from Settings, which holds console-side presentation choices. These
 * switches reach into the running Android app: flipping one here changes what
 * every reader sees within a second or so, with no release. That is worth its own
 * page and its own warning rather than another block of toggles on Settings.
 */
import { useEffect, useState } from 'react'
import { useToast } from '../store/store.jsx'
import { SectionHead, Switch } from '../components/ui.jsx'
import { FLAG_DEFS, seedMissingFlags, setFlag, watchFlags } from '../store/featureFlags.js'
import { isFirebaseReady } from '../firebase.js'

export default function FeatureFlags() {
  const { notify } = useToast()
  const [flags, setFlags] = useState(null)
  // Per-key, so one slow write does not freeze the other three switches.
  const [saving, setSaving] = useState({})

  useEffect(() => watchFlags(setFlags), [])

  const toggle = async (def, next) => {
    // Move the switch immediately, then correct it if the write is refused. The
    // alternative - waiting for the round trip - makes every tap feel broken on a
    // slow connection, and the listener overwrites this the moment it confirms.
    setFlags((prev) => ({ ...prev, [def.key]: next }))
    setSaving((prev) => ({ ...prev, [def.key]: true }))
    try {
      await setFlag(def.key, next)
      notify(`${def.label} ${next ? 'shown' : 'hidden'} in the app`)
    } catch (err) {
      setFlags((prev) => ({ ...prev, [def.key]: !next }))
      notify(err?.code === 'PERMISSION_DENIED'
        ? 'Only a super admin can change feature flags'
        : `Could not save: ${err?.message ?? 'unknown error'}`)
    } finally {
      setSaving((prev) => ({ ...prev, [def.key]: false }))
    }
  }

  const seed = async () => {
    try {
      const written = await seedMissingFlags()
      notify(written === 0 ? 'All flags already exist' : `Created ${written} flag(s)`)
    } catch (err) {
      notify(`Could not create flags: ${err?.message ?? 'unknown error'}`)
    }
  }

  if (!isFirebaseReady()) {
    return (
      <>
        <SectionHead title="App feature flags" sub="Needs a Firebase connection" />
        <div className="card card-pad">
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5 }}>
            Firebase is not configured for this console, so there is nothing to read or write.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <SectionHead
        title="App feature flags"
        sub="Live switches — the Android app picks these up within seconds, no update needed"
      />

      <div className="card card-pad">
        {flags === null ? (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5 }}>Loading…</p>
        ) : (
          FLAG_DEFS.map((def) => (
            <div
              key={def.key}
              className="btn-row"
              style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}
            >
              <div style={{ flex: 1 }}>
                <div className="cell-title">{def.label}</div>
                <div className="cell-sub">{def.desc}</div>
                <div className="cell-sub" style={{ opacity: 0.6, fontFamily: 'monospace' }}>
                  {def.key} · {def.optIn ? 'off until switched on' : 'on until switched off'}
                </div>
              </div>
              <Switch
                checked={flags[def.key]}
                onChange={(v) => { if (!saving[def.key]) toggle(def, v) }}
              />
            </div>
          ))
        )}
      </div>

      <SectionHead title="How these behave" sub="Worth knowing before you switch one off" />
      <div className="card card-pad">
        <ul className="plain" style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.7 }}>
          <li>
            Each flag has a shipped default, shown under its name. A flag that is
            <strong> on until switched off</strong> stays on if the app cannot reach the server,
            so a network problem never blanks the toolbar; one that is
            <strong> off until switched on</strong> stays hidden the same way, so nothing
            unreleased leaks.
          </li>
          <li>
            Changes reach open apps live — the app holds a listener on this node rather than
            reading it once at launch.
          </li>
          <li>
            Turning something off only hides the control. Nothing is deleted, and switching
            it back on restores it exactly as it was.
          </li>
          <li>Only a super admin can write these.</li>
        </ul>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={seed}>
            Create any missing flags
          </button>
        </div>
      </div>
    </>
  )
}
