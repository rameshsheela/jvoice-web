import { createContext, useContext, useState } from 'react'
import { toLt } from '../i18n/localized.js'
import { canTranslate, translateText } from '../i18n/translate.js'

/**
 * Bilingual form fields with a single writing language.
 *
 * Stories are stored in both languages (see NewsCodec.kt and firestoreData.js)
 * and the reader picks one. An editor, though, writes in one language at a
 * time, so a form shows one input per field in the language chosen on its
 * [LangToggle], and each field offers **Auto-translate** to fill the other
 * language from what was just typed. The other language's current text sits
 * under the input in small type, so a stale translation is visible rather
 * than silently shipped.
 *
 * The writing language is shared through context so a form sets it once.
 */

const LangContext = createContext({ lang: 'en', setLang: () => {} })

const OTHER = { en: 'te', te: 'en' }
const LABEL = { en: 'English', te: 'తెలుగు' }
const TAG = { en: 'EN', te: 'తె' }

/** Wraps a form; owns the writing language. */
export function LangForm({ initial = 'en', children }) {
  const [lang, setLang] = useState(initial)
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
}

/** The "Writing in" switch. Place once at the top of a LangForm. */
export function LangToggle() {
  const { lang, setLang } = useContext(LangContext)
  return (
    <div className="lang-toggle">
      <span className="lang-toggle-label">Writing in</span>
      {['en', 'te'].map((code) => (
        <button
          key={code}
          type="button"
          className={code === lang ? 'lang-btn on' : 'lang-btn'}
          onClick={() => setLang(code)}
          aria-pressed={code === lang}
        >
          {LABEL[code]}
        </button>
      ))}
      {canTranslate() ? null : (
        <span className="lang-toggle-note">Auto-translate is not configured</span>
      )}
    </div>
  )
}

/** One bilingual value, edited in the form's writing language. */
export default function LtField({ label, value, onChange, multiline = false, minHeight = 60, error = null }) {
  const { lang } = useContext(LangContext)
  const v = toLt(value)
  const other = OTHER[lang]
  const [busy, setBusy] = useState(false)
  const Input = multiline ? 'textarea' : 'input'

  const translate = async () => {
    setBusy(true)
    const out = await translateText(v[lang], lang, other)
    setBusy(false)
    if (out != null) onChange({ ...v, [other]: out })
  }

  return (
    <div className="field lt-field">
      <span>
        {label} <span className="lt-tag">{TAG[lang]}</span>
      </span>
      <Input
        type="text"
        style={multiline ? { minHeight } : undefined}
        value={v[lang]}
        onChange={(e) => onChange({ ...v, [lang]: e.target.value })}
      />
      <div className="lt-other">
        <span className="lt-tag">{TAG[other]}</span>
        <span className={v[other] ? 'lt-other-text' : 'lt-other-text empty'}>
          {v[other] || 'Not written yet'}
        </span>
        {canTranslate() ? (
          <button type="button" className="small ghost" onClick={translate} disabled={busy || !v[lang].trim()}>
            {busy ? 'Translating…' : 'Auto-translate'}
          </button>
        ) : null}
      </div>
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  )
}
