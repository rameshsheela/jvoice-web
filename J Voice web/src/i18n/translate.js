/**
 * Machine translation between the two reader languages, for the console's
 * story forms - an editor writes in one language and has the other filled
 * in, then corrects it.
 *
 * Google Cloud Translation (basic, v2) with a browser key that is restricted
 * to this API and to the console's domains, which is Google's own pattern
 * for keys shipped in web pages. The key is a project setting, not a secret:
 * it can only call Translation, only from our pages, and is billed to the
 * project at a few dollars per million characters.
 *
 * Every failure - no key, network, quota - resolves to `null`, and the form
 * simply leaves the other language for the editor to type. Translation is
 * a convenience, never a gate.
 */

import { TRANSLATE_KEY } from '../firebase.js'

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2'

export const canTranslate = () => Boolean(TRANSLATE_KEY)

/** Translates `text` from `from` to `to` ('en' | 'te'). Null when it cannot. */
export async function translateText(text, from, to) {
  const q = (text ?? '').trim()
  if (!q || !TRANSLATE_KEY || from === to) return null
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(TRANSLATE_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: [q], source: from, target: to, format: 'text' })
    })
    if (!res.ok) {
      console.warn('[translate] HTTP', res.status, await res.text().catch(() => ''))
      return null
    }
    const json = await res.json()
    return json?.data?.translations?.[0]?.translatedText ?? null
  } catch (e) {
    console.warn('[translate] failed:', e.message)
    return null
  }
}
