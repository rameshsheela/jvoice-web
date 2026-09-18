/**
 * Firebase for the admin console.
 *
 * ## The config is not a secret
 *
 * Every value below ships to the browser in the bundle, and that is by design —
 * a Firebase web config is an *identifier*, not a credential. Locking data down
 * is the job of the security rules (`firebase/database.rules.json`), which is why
 * those deny by default and resolve every read against the caller's role. Putting
 * this in an env var would hide it from a casual reader of the repo and from
 * nobody else.
 *
 * ## Realtime Database, not Firestore
 *
 * Auth and the session signals — `role`, `isLogin`, `forceLogoutAt` — live in the
 * Realtime Database, because the kill-switch and the live force-logout listener
 * are built on RTDB value events. Firestore holds the content (articles, study
 * material, the question bank) where real queries matter.
 *
 * Both handles are created here. They are separate products with separate SDK
 * entry points, and the two must never be confused: `getFirebaseDb()` is the
 * Realtime Database and only `ref()`/`get()`/`onValue()` accept it, while
 * `getFirebaseStore()` is Firestore and only `collection()`/`doc()` accept it.
 * Passing one to the other's API throws at the first call, which is how the
 * content sync was silently dead before this.
 */

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getFirestore } from 'firebase/firestore'

export const firebaseConfig = {
  apiKey: 'AIzaSyBo8tSYz3tplracFn8ClHkcz9NtsOHO38s',
  authDomain: 'jvoice-b4b2e.firebaseapp.com',
  databaseURL: 'https://jvoice-b4b2e-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'jvoice-b4b2e',
  storageBucket: 'jvoice-b4b2e.firebasestorage.app',
  messagingSenderId: '180885422721',
  appId: '1:180885422721:web:5e2129cef208caf1234380',
  measurementId: 'G-VE7TXB36R3'
}

/** Staff sign in with a bare username; this is what it expands to. */
export const LOGIN_DOMAIN = 'jvoicenews.com'

/** `kiran` -> `kiran@jvoicenews.com`; an address with `@` passes through. */
export function toEmail(loginId) {
  const id = String(loginId ?? '').trim()
  return id.includes('@') ? id : `${id}@${LOGIN_DOMAIN}`
}

let app = null
let auth = null
let db = null
let store = null
let initError = null

/**
 * Initialises once, and never throws.
 *
 * A failure here must not take the console down: the demo logins still work
 * without Firebase, so the app degrades to those rather than showing a blank
 * page. Callers check `isFirebaseReady()`.
 */
function init() {
  if (app || initError) return
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getDatabase(app)
    store = getFirestore(app)
  } catch (e) {
    initError = e
    console.error('[firebase] initialisation failed, falling back to demo logins:', e)
  }
}

init()

export const isFirebaseReady = () => Boolean(auth && db && store)
/** The initialised app, for services set up on demand (Storage). */
export const getFirebaseApp = () => app
export const firebaseInitError = () => initError
export const getFirebaseAuth = () => auth
/** Realtime Database — accounts, session signals, feature flags. */
export const getFirebaseDb = () => db
/** Firestore — news, study material, the question bank, exams. */
export const getFirebaseStore = () => store

/**
 * Browser key for Google Cloud Translation, used by the console's story forms
 * (see i18n/translate.js). Restricted in Google Cloud to that one API and to
 * the console's domains; it is not a secret and grants nothing else.
 */
export const TRANSLATE_KEY = 'AIzaSyC_RpCeKYHA7W3_xdDewtX-C9tUbqLUIeQ'
