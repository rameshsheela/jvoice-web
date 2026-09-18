/**
 * J Voice Cloud Functions.
 *
 * One job: when the desk writes a broadcast to `newsNotifications` (see
 * notifyPublished in 'J Voice web/src/store/firestoreData.js'), push it to
 * every reader's phone over FCM. The Firestore doc is still what the app's
 * Notifications tab lists; this is what makes it show up in the status bar.
 *
 * Why a function and not the console itself: FCM's HTTP v1 API needs a
 * service-account credential, which cannot sit in a browser bundle. A Firestore
 * trigger keeps the console's job to "write the doc" and moves the send here.
 *
 * Delivery: readers subscribe to the `news` topic (NewsPush.kt). The message is
 * data-only - the app builds the notification itself, in the reader's chosen
 * language, so both languages travel in the payload.
 *
 * Deploy (Blaze plan; the project is on it and this function is live in asia-south1):
 *   cd firebase/functions && npm install
 *   firebase deploy --only functions   (from the repo root)
 */
const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')
const { initializeApp } = require('firebase-admin/app')
const { getMessaging } = require('firebase-admin/messaging')

initializeApp()
setGlobalOptions({ region: 'asia-south1', maxInstances: 5 })

/** Topic every reader device subscribes to on launch. */
const TOPIC = 'news'

/** A bilingual `{en, te}` map, or a plain string, to one side. */
const side = (v, lang) => (typeof v === 'string' ? v : (v && v[lang]) || '') 

exports.pushNewsNotification = onDocumentCreated('newsNotifications/{id}', async (event) => {
  const snap = event.data
  if (!snap) return
  const n = snap.data()

  // Targeted notifications (approval, rejection - `targetRole` set) are for the
  // desk's own tab, never for readers' phones.
  if (n.targetRole) return

  const message = {
    topic: TOPIC,
    data: {
      notificationId: snap.id,
      articleId: String(n.articleId || ''),
      type: String(n.type || 'GENERAL'),
      titleEn: side(n.title, 'en'),
      titleTe: side(n.title, 'te'),
      messageEn: side(n.message, 'en'),
      messageTe: side(n.message, 'te')
    },
    android: {
      // High priority so the data message wakes the app from Doze; breaking
      // news is the whole point of pushing at all.
      priority: 'high',
      ttl: 6 * 60 * 60 * 1000
    }
  }

  try {
    const id = await getMessaging().send(message)
    console.log(`[push] ${snap.id} -> topic ${TOPIC}: ${id}`)
  } catch (e) {
    console.error(`[push] ${snap.id} failed:`, e.message)
  }
})
