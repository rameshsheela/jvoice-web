/**
 * Firestore ↔ console store.
 *
 * Two halves:
 *
 *  * **codecs** — the same document shapes the Android app reads and writes.
 *    They are duplicated here rather than shared because the two clients are
 *    different languages; the comments in `NewsCodec.kt` / `StudyCodec.kt` are the
 *    reference, and any change has to land in both.
 *
 *  * **sync** — hydrates the store from snapshot listeners, and writes local
 *    changes back by DIFFING the collection rather than by mapping each of the
 *    ~50 reducer actions to a write. Diffing means a new action is synced the day
 *    it is added, with nobody having to remember to wire it up.
 */

import {
  collection as fsCollection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch
} from 'firebase/firestore'
import { getFirebaseStore, isFirebaseReady } from '../firebase.js'
import { toLt, toLtList, trimLt } from '../i18n/localized.js'

/* ============================================================ collections */

export const COLLECTIONS = {
  categories: 'categories',
  articles: 'articles',
  subjects: 'subjects',
  topics: 'topics',
  studyArticles: 'studyArticles',
  questions: 'questions',
  exams: 'exams',
  tracks: 'examTracks'
}

/* ================================================================= codecs */

/**
 * Article status, both ways. Firestore (and the app) store the enum name;
 * the console was written against the display label and compares against
 * NEWS_STATUS everywhere, so the translation lives here, at the boundary,
 * rather than in forty comparisons.
 */
const STATUS_FROM_DB = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SENT_BACK: 'Sent Back',
  PUBLISHED: 'Published'
}
const STATUS_TO_DB = Object.fromEntries(Object.entries(STATUS_FROM_DB).map(([k, v]) => [v, k]))
const statusFromDb = (v) => STATUS_FROM_DB[v] ?? (Object.values(STATUS_FROM_DB).includes(v) ? v : 'Draft')
const statusToDb = (v) => STATUS_TO_DB[v] ?? (STATUS_FROM_DB[v] ? v : 'DRAFT')

const ltOut = (v) => {
  const t = trimLt(v)
  return { en: t.en, te: t.te }
}
const ltListOut = (list) => (list ?? []).map(ltOut)

export const CODECS = {
  categories: {
    from: (id, d) => ({
      id,
      name: toLt(d.name),
      emoji: d.emoji ?? '📰',
      // Missing means enabled: a category added by hand without the flag should
      // appear, not silently vanish.
      isEnabled: d.isEnabled !== false
    }),
    to: (c) => ({ name: ltOut(c.name), emoji: c.emoji ?? '📰', isEnabled: c.isEnabled !== false })
  },

  articles: {
    from: (id, d) => ({
      id,
      headline: toLt(d.headline),
      shortDescription: toLt(d.shortDescription),
      content: toLt(d.content),
      categoryId: d.categoryId ?? '',
      location: d.location ?? '',
      imageUrl: d.imageUrl ?? '',
      photoUrls: d.photoUrls ?? [],
      videoUrls: d.videoUrls ?? [],
      tags: toLtList(d.tags),
      isBreaking: Boolean(d.isBreaking),
      isFeatured: Boolean(d.isFeatured),
      isTrending: Boolean(d.isTrending),
      status: statusFromDb(d.status),
      reporterId: d.reporterId ?? '',
      reporterName: d.reporterName ?? '',
      // Carried through untouched. The app renders it on the byline, and dropping
      // it here would blank every reporter photo the moment anyone saved a story.
      reporterAvatarUrl: d.reporterAvatarUrl ?? '',
      createdAt: d.createdAt ?? 0,
      updatedAt: d.updatedAt ?? d.createdAt ?? 0,
      publishedAt: d.publishedAt ?? null,
      rejectionReason: d.rejectionReason ? toLt(d.rejectionReason) : null,
      editorNote: d.editorNote ? toLt(d.editorNote) : null,
      views: d.views ?? 0,
      reportCount: d.reportCount ?? 0,
      likes: d.likes ?? 0,
      dislikes: d.dislikes ?? 0,
      comments: d.comments ?? 0,
      detailEnabled: d.detailEnabled !== false,
      // Whether readers get a notification when this story goes live. Chosen
      // at creation time; older stories without the field behave as before.
      notifyReaders: d.notifyReaders !== false
    }),
    to: (a) => ({
      headline: ltOut(a.headline),
      shortDescription: ltOut(a.shortDescription),
      content: ltOut(a.content),
      categoryId: a.categoryId ?? '',
      location: a.location ?? '',
      imageUrl: a.imageUrl ?? '',
      photoUrls: a.photoUrls ?? [],
      videoUrls: a.videoUrls ?? [],
      tags: ltListOut(a.tags),
      isBreaking: Boolean(a.isBreaking),
      isFeatured: Boolean(a.isFeatured),
      isTrending: Boolean(a.isTrending),
      status: statusToDb(a.status),
      reporterId: a.reporterId ?? '',
      reporterName: a.reporterName ?? '',
      reporterAvatarUrl: a.reporterAvatarUrl ?? '',
      createdAt: a.createdAt ?? Date.now(),
      updatedAt: a.updatedAt ?? Date.now(),
      publishedAt: a.publishedAt ?? null,
      rejectionReason: a.rejectionReason ? ltOut(a.rejectionReason) : null,
      editorNote: a.editorNote ? ltOut(a.editorNote) : null,
      views: a.views ?? 0,
      reportCount: a.reportCount ?? 0,
      likes: a.likes ?? 0,
      dislikes: a.dislikes ?? 0,
      comments: a.comments ?? 0,
      detailEnabled: a.detailEnabled !== false,
      notifyReaders: a.notifyReaders !== false,
      // Denormalised sort key, matching NewsCodec.kt — publishedAt is null until
      // publication, and Firestore cannot order on a field some documents lack.
      sortAt: a.publishedAt ?? a.createdAt ?? Date.now()
    })
  },

  subjects: {
    from: (id, d) => ({
      id,
      name: toLt(d.name),
      emoji: d.emoji ?? '📘',
      isEnabled: d.isEnabled !== false
    }),
    to: (s) => ({ name: ltOut(s.name), emoji: s.emoji ?? '📘', isEnabled: s.isEnabled !== false })
  },

  topics: {
    from: (id, d) => ({
      id,
      subjectId: d.subjectId ?? '',
      name: toLt(d.name),
      order: d.order ?? 0,
      difficulty: d.difficulty ?? 'MEDIUM',
      isEnabled: d.isEnabled !== false
    }),
    to: (t) => ({
      subjectId: t.subjectId ?? '',
      name: ltOut(t.name),
      order: t.order ?? 0,
      difficulty: t.difficulty ?? 'MEDIUM',
      isEnabled: t.isEnabled !== false
    })
  },

  studyArticles: {
    from: (id, d) => ({
      id,
      subjectId: d.subjectId ?? '',
      topicId: d.topicId ?? '',
      title: toLt(d.title),
      description: toLt(d.description),
      content: toLt(d.content),
      importantPoints: toLtList(d.importantPoints),
      examples: toLtList(d.examples),
      formulas: toLtList(d.formulas),
      readingMinutes: d.readingMinutes ?? 5,
      status: d.status ?? 'PUBLISHED',
      authorName: d.authorName ?? 'J Voice Desk',
      createdAt: d.createdAt ?? 0
    }),
    to: (a) => ({
      subjectId: a.subjectId ?? '',
      topicId: a.topicId ?? '',
      title: ltOut(a.title),
      description: ltOut(a.description),
      content: ltOut(a.content),
      importantPoints: ltListOut(a.importantPoints),
      examples: ltListOut(a.examples),
      formulas: ltListOut(a.formulas),
      readingMinutes: a.readingMinutes ?? 5,
      status: a.status ?? 'PUBLISHED',
      authorName: a.authorName ?? 'J Voice Desk',
      createdAt: a.createdAt ?? Date.now()
    })
  },

  questions: {
    from: (id, d) => ({
      id,
      subjectId: d.subjectId ?? '',
      topicId: d.topicId ?? '',
      text: toLt(d.text),
      // Positional and shared across languages: correctIndex points into this
      // list, so the ORDER is the answer key. Never reorder on save.
      options: toLtList(d.options),
      correctIndex: d.correctIndex ?? 0,
      explanation: toLt(d.explanation),
      difficulty: d.difficulty ?? 'MEDIUM',
      type: d.type ?? 'MCQ',
      source: d.source ?? 'SAMPLE',
      paperName: d.paperName ?? '',
      year: d.year ?? '',
      status: d.status ?? 'PUBLISHED'
    }),
    to: (q) => ({
      subjectId: q.subjectId ?? '',
      topicId: q.topicId ?? '',
      text: ltOut(q.text),
      options: ltListOut(q.options),
      correctIndex: q.correctIndex ?? 0,
      explanation: ltOut(q.explanation),
      difficulty: q.difficulty ?? 'MEDIUM',
      type: q.type ?? 'MCQ',
      source: q.source ?? 'SAMPLE',
      paperName: q.paperName ?? '',
      year: q.year ?? '',
      status: q.status ?? 'PUBLISHED'
    })
  },

  exams: {
    from: (id, d) => ({
      id,
      title: toLt(d.title),
      type: d.type ?? 'DAILY',
      dateLabel: d.dateLabel ?? '',
      durationMinutes: d.durationMinutes ?? 20,
      questionIds: d.questionIds ?? [],
      subjectIds: d.subjectIds ?? [],
      difficulty: d.difficulty ?? 'MEDIUM',
      instructions: toLt(d.instructions),
      isActive: d.isActive !== false,
      trackIds: d.trackIds ?? []
    }),
    to: (e) => ({
      title: ltOut(e.title),
      type: e.type ?? 'DAILY',
      dateLabel: e.dateLabel ?? '',
      durationMinutes: e.durationMinutes ?? 20,
      questionIds: e.questionIds ?? [],
      subjectIds: e.subjectIds ?? [],
      difficulty: e.difficulty ?? 'MEDIUM',
      instructions: ltOut(e.instructions),
      isActive: e.isActive !== false,
      trackIds: e.trackIds ?? []
    })
  },

  tracks: {
    from: (id, d) => ({
      id,
      name: toLt(d.name),
      shortName: d.shortName ?? '',
      emoji: d.emoji ?? '🎯',
      group: d.group ?? 'GROUPS',
      tagline: toLt(d.tagline),
      qualification: toLt(d.qualification),
      ageLimit: toLt(d.ageLimit),
      vacancyLabel: toLt(d.vacancyLabel),
      examDateLabel: toLt(d.examDateLabel),
      totalQuestions: d.totalQuestions ?? 0,
      totalMarks: d.totalMarks ?? 0,
      durationMinutes: d.durationMinutes ?? 0,
      negativeMarking: toLt(d.negativeMarking),
      sections: d.sections ?? [],
      stages: toLtList(d.stages),
      keyDates: (d.keyDates ?? []).map((k) => ({
        label: toLt(k.label),
        dateLabel: k.dateLabel ?? '',
        note: toLt(k.note)
      })),
      isEnabled: d.isEnabled !== false
    }),
    to: (t) => ({
      name: ltOut(t.name),
      shortName: t.shortName ?? '',
      emoji: t.emoji ?? '🎯',
      group: t.group ?? 'GROUPS',
      tagline: ltOut(t.tagline),
      qualification: ltOut(t.qualification),
      ageLimit: ltOut(t.ageLimit),
      vacancyLabel: ltOut(t.vacancyLabel),
      examDateLabel: ltOut(t.examDateLabel),
      totalQuestions: t.totalQuestions ?? 0,
      totalMarks: t.totalMarks ?? 0,
      durationMinutes: t.durationMinutes ?? 0,
      negativeMarking: ltOut(t.negativeMarking),
      sections: t.sections ?? [],
      stages: ltListOut(t.stages),
      keyDates: (t.keyDates ?? []).map((k) => ({
        label: ltOut(k.label),
        dateLabel: k.dateLabel ?? '',
        note: ltOut(k.note)
      })),
      isEnabled: t.isEnabled !== false
    })
  }
}

/* ============================================================ notifications */

/**
 * A fresh Firestore id for a new document in `name` - so two consoles (or
 * one reloaded) can never mint the same id and overwrite each other's story,
 * which a page-local counter did.
 */
export function newDocId(name) {
  const db = getFirebaseStore()
  return db ? doc(fsCollection(db, name)).id : `local_${Date.now()}`
}

/**
 * Tells readers a story is live. Written to `newsNotifications` in the shape
 * the app decodes (NewsCodec.kt): bilingual title and message, a type, and
 * no targetRole - which is what makes it a broadcast the app may read.
 *
 * Honours the story's "Send notification" switch: a story filed with
 * `notifyReaders` off goes live silently. Returns whether one was sent.
 */
export function notifyPublished(article) {
  const db = getFirebaseStore()
  if (!db || !article || article.notifyReaders === false) return false
  const headline = toLt(article.headline)
  const breaking = Boolean(article.isBreaking)
  const data = {
    title: breaking
      ? { en: 'Breaking news', te: 'బ్రేకింగ్ న్యూస్' }
      : { en: 'New story', te: 'కొత్త వార్త' },
    message: { en: headline.en || headline.te, te: headline.te || headline.en },
    timeMillis: Date.now(),
    type: breaking ? 'BREAKING' : 'GENERAL',
    isRead: false,
    articleId: article.id,
    targetRole: null
  }
  setDoc(doc(fsCollection(db, 'newsNotifications')), data).catch((e) =>
    console.error('[notify] write failed:', e.message)
  )
  return true
}

/* =================================================================== sync */

/**
 * Subscribes to every mapped collection.
 *
 * `onHydrate(stateKey, rows)` is called with decoded rows on every snapshot,
 * including the first. Returns an unsubscribe function.
 */
export function subscribeAll(onHydrate, onError) {
  if (!isFirebaseReady()) return () => {}
  const db = getFirebaseStore()
  const stops = Object.entries(COLLECTIONS).map(([stateKey, name]) =>
    onSnapshot(
      fsCollection(db, name),
      (snap) => {
        const codec = CODECS[stateKey]
        const rows = snap.docs.map((d) => {
          try {
            return codec.from(d.id, d.data())
          } catch (e) {
            console.warn(`[sync] skipping malformed ${name}/${d.id}:`, e.message)
            return null
          }
        }).filter(Boolean)
        onHydrate(stateKey, rows)
      },
      (e) => {
        // Expected for collections this role cannot read - `questions` is
        // desk-only, so a signed-out console gets denied here and simply shows
        // nothing.
        console.warn(`[sync] ${name} listener: ${e.message}`)
        onError?.(stateKey, e)
      }
    )
  )
  return () => stops.forEach((stop) => stop())
}

/**
 * Writes local changes back by comparing the previous and next arrays.
 *
 * Diffing instead of mapping each reducer action keeps this correct as actions
 * are added: anything that changes a synced collection is picked up, whether or
 * not anyone remembered to wire it.
 *
 * `baseline` is the last state known to match the server. It is updated in place
 * so the echo from our own write does not look like a further local change and
 * loop.
 */
export function syncCollection(stateKey, previous, next, baseline) {
  if (!isFirebaseReady()) return
  const db = getFirebaseStore()
  const name = COLLECTIONS[stateKey]
  const codec = CODECS[stateKey]
  if (!name || !codec) return

  const prevById = new Map((previous ?? []).map((r) => [r.id, r]))
  const nextById = new Map((next ?? []).map((r) => [r.id, r]))

  for (const [id, row] of nextById) {
    const encoded = codec.to(row)
    const signature = JSON.stringify(encoded)
    // Unchanged since the server last told us about it - nothing to write.
    if (baseline.get(id) === signature) continue
    baseline.set(id, signature)
    // Skipped when the row is identical to what we already had locally AND the
    // baseline simply had not been recorded yet, which is the hydration case.
    if (prevById.has(id) && JSON.stringify(codec.to(prevById.get(id))) === signature) continue
    setDoc(doc(db, name, id), encoded, { merge: true }).catch((e) =>
      console.error(`[sync] write ${name}/${id} failed:`, e.message)
    )
  }

  for (const id of prevById.keys()) {
    if (nextById.has(id)) continue
    baseline.delete(id)
    deleteWithChildren(db, name, id).catch((e) =>
      console.error(`[sync] delete ${name}/${id} failed:`, e.message)
    )
  }
}

/** What each collection keeps nested under its documents. */
const CHILD_COLLECTIONS = {
  articles: ['comments', 'reports'],
}

/**
 * Deletes a document and the subcollections listed for its collection.
 * Firestore does not cascade on its own - deleting `articles/x` would leave
 * every comment and report under it orphaned. Children go first, in batches,
 * and the document last, so a failure part-way leaves the story to retry.
 */
async function deleteWithChildren(db, name, id) {
  const ref = doc(db, name, id)
  for (const child of CHILD_COLLECTIONS[name] ?? []) {
    const snap = await getDocs(fsCollection(ref, child))
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = writeBatch(db)
      snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
  }
  await deleteDoc(ref)
}

/** Records a server snapshot as the baseline, so hydration is never written back. */
export function recordBaseline(stateKey, rows, baseline) {
  const codec = CODECS[stateKey]
  baseline.clear()
  for (const row of rows ?? []) {
    baseline.set(row.id, JSON.stringify(codec.to(row)))
  }
}
