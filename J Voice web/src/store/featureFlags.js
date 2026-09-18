/**
 * The app-level feature flags at `/flags` in the Realtime Database.
 *
 * These are the switches the Android app reads to decide which controls to show.
 * The console is the only place they are ever written; the rules allow the write
 * to a super admin alone, so a non-admin turning a switch here gets a permission
 * error from Firebase rather than a silent no-op.
 *
 * Kept out of the main store on purpose. Everything in the store is Firestore
 * content that flows through the reducer and the diff-based write-back; this is
 * four booleans in a different database with different rules, and pushing them
 * through that machinery would mean teaching it a second backend for no gain.
 */
import { onValue, ref, set, get } from 'firebase/database'
import { getFirebaseDb, isFirebaseReady } from '../firebase.js'

const NODE = 'flags'

/**
 * The flags the app understands, in the order they should be listed.
 *
 * The keys have to match `FeatureFlags.Keys` in the Android app character for
 * character — a typo here writes a key nothing reads, and the switch appears to
 * do nothing at all.
 */
export const FLAG_DEFS = [
  {
    key: 'locationChips',
    label: 'Category chips',
    desc: 'The scrolling category filter row under the toolbar in the swipe feed.',
    optIn: false
  },
  {
    key: 'newsLocationDropdown',
    label: 'Location picker in the toolbar',
    desc: 'The city dropdown beside the J Voice logo. Readers can always change their location from Profile.',
    optIn: true
  },
  {
    key: 'shortsTab',
    label: 'Clips tab',
    desc: 'Short-video clips: the bottom-bar tab and the screen behind it. ' +
      'Turning this off also redirects anyone currently on the Clips screen.',
    optIn: true
  },
  {
    key: 'studyTab',
    label: 'Study tab',
    desc: 'The exam-preparation module in the reader bottom bar. With Clips and Study both off, the bar is hidden and the feed is the whole screen.',
    optIn: true
  },
  {
    key: 'staffLogin',
    label: 'Staff sign-in on Profile',
    desc: 'The "Staff sign in" button at the foot of the reader Profile screen, which opens the desk login inside the app.',
    optIn: true
  }
]

/**
 * What a missing flag means, per flag.
 *
 * Matches the app: a flag that ships ON (`FeatureFlags.flagEnabled`) reads as
 * on until someone writes false, so a network problem cannot blank the app; a
 * flag that ships OFF (`flagOptedIn`) reads as off until someone writes true,
 * so a network problem cannot reveal something unreleased. `optIn` on the
 * definition says which kind each is.
 */
export function interpret(value, def) {
  if (value === undefined || value === null) return !(def?.optIn)
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    return !(v === 'false' || v === 'no' || v === '0')
  }
  return true
}

/** Fills in every known key so the UI never binds a switch to `undefined`. */
export function normalise(raw) {
  const source = raw ?? {}
  const out = {}
  for (const def of FLAG_DEFS) out[def.key] = interpret(source[def.key], def)
  return out
}

/** Subscribes to the live flags. Returns an unsubscribe, or a no-op when offline. */
export function watchFlags(onChange) {
  if (!isFirebaseReady()) {
    onChange(normalise(null))
    return () => {}
  }
  return onValue(
    ref(getFirebaseDb(), NODE),
    (snap) => onChange(normalise(snap.val())),
    // A rules failure must not leave the switches stuck mid-load. Showing the
    // defaults is honest: it is what the app itself would fall back to.
    () => onChange(normalise(null))
  )
}

/**
 * Writes one flag.
 *
 * Writes the single child rather than the whole object so two admins editing
 * different switches at the same moment do not overwrite each other. Rejects
 * (rather than resolving quietly) when the rules refuse, so the caller can say so.
 */
export async function setFlag(key, value) {
  if (!isFirebaseReady()) throw new Error('Firebase is not configured')
  await set(ref(getFirebaseDb(), `${NODE}/${key}`), Boolean(value))
}

/**
 * Writes any flags the node does not have yet, leaving existing ones alone.
 *
 * Used once from the console so the node exists and is visible in the Firebase
 * dashboard. Not required for correctness — the app treats an absent node as
 * everything-on — but an empty node is hard to tell apart from a broken one.
 */
export async function seedMissingFlags() {
  if (!isFirebaseReady()) throw new Error('Firebase is not configured')
  const snap = await get(ref(getFirebaseDb(), NODE))
  const current = snap.val() ?? {}
  const writes = FLAG_DEFS
    .filter((def) => current[def.key] === undefined)
    .map((def) => set(ref(getFirebaseDb(), `${NODE}/${def.key}`), !def.optIn))
  await Promise.all(writes)
  return writes.length
}
