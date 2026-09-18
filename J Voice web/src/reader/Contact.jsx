import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { getFirebaseStore, isFirebaseReady } from '../firebase.js'

/**
 * The contact page at `/contact`: where J Voice is, how to call, and a short
 * form that lands in Firestore (`contactMessages`) for the desk.
 *
 * Public and account-free like the rest of the reader. The form asks for
 * the least that lets someone be answered - a name, a way to reach them and
 * the message - and nothing is required beyond the message itself and one
 * contact detail.
 */

export const CONTACT = {
  name: 'J Voice',
  addressLines: ['Lyr Garden Road, beside Bus Stand', 'Thorrur, Telangana 506163'],
  plusCode: 'HMP4+CJG',
  phone: '8919931583',
  phoneDisplay: '+91 89199 31583',
  // Filled in when the newsroom's address is confirmed.
  email: ''
}

const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent(`${CONTACT.plusCode} ${CONTACT.addressLines.join(', ')}`)

export default function Contact() {
  const [form, setForm] = useState({ name: '', contact: '', message: '' })
  const [state, setState] = useState('idle') // idle | sending | sent | failed
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const message = form.message.trim()
    const contact = form.contact.trim()
    if (!message) return setError('Please write your message.')
    if (!contact) return setError('Please add a phone number or email so we can reply.')
    setError(null)
    if (!isFirebaseReady()) return setState('failed')
    setState('sending')
    try {
      await addDoc(collection(getFirebaseStore(), 'contactMessages'), {
        name: form.name.trim().slice(0, 80),
        contact: contact.slice(0, 120),
        message: message.slice(0, 2000),
        page: 'web',
        status: 'NEW',
        createdAt: serverTimestamp()
      })
      setState('sent')
      setForm({ name: '', contact: '', message: '' })
    } catch (err) {
      console.error('[contact] send failed:', err.message)
      setState('failed')
    }
  }

  return (
    <main className="rd-main">
      <section className="ct-grid">
        <div className="ld-card ct-card">
          <h2>Reach the newsroom</h2>
          <address className="ct-address">
            <strong>{CONTACT.name}</strong>
            {CONTACT.addressLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
            <span className="ct-plus">Plus code {CONTACT.plusCode}</span>
          </address>
          <p className="ct-line">
            <span className="ct-k">Phone</span>
            <a href={`tel:+91${CONTACT.phone}`}>{CONTACT.phoneDisplay}</a>
          </p>
          {CONTACT.email ? (
            <p className="ct-line">
              <span className="ct-k">Email</span>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </p>
          ) : null}
          <a className="rd-cta" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
            Open in Google Maps
          </a>
        </div>

        <form className="ld-card ct-card" onSubmit={submit}>
          <h2>Send us a message</h2>
          <p className="ct-sub">A news tip, a correction, or anything else - we read every message.</p>
          <label className="field">
            <span>Your name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Optional"
            />
          </label>
          <label className="field">
            <span>Phone or email *</span>
            <input
              type="text"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="So we can reply"
            />
          </label>
          <label className="field">
            <span>Message *</span>
            <textarea
              style={{ minHeight: 140 }}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Write your message…"
            />
          </label>
          {error ? <div className="field-error">{error}</div> : null}
          {state === 'sent' ? (
            <div className="ct-ok">Thank you - your message has reached the J Voice desk.</div>
          ) : null}
          {state === 'failed' ? (
            <div className="field-error">Could not send just now. Please call us, or try again in a moment.</div>
          ) : null}
          <div className="ct-actions">
            <button className="rd-cta ct-send" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
