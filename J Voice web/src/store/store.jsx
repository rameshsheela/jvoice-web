import { isFirebaseReady } from '../firebase.js'
import { L, lt } from '../i18n/localized.js'
import { useRef } from 'react'
import { COLLECTIONS, recordBaseline, subscribeAll, syncCollection } from './firestoreData.js'
import { observeSession, signInStaff, signOutStaff, watchForceLogout } from './staffAuth.js'
import { createContext, useContext, useMemo, useReducer, useState, useCallback, useEffect } from 'react'
import {
  categories as seedCategories,
  newsArticles as seedArticles,
  newsUsers as seedUsers,
  systemSettings as seedSettings,
  roles as seedRoles,
  MODULES,
  PERMS,
  NEWS_STATUS
} from '../data/newsData.js'
import {
  subjects as seedSubjects,
  topics as seedTopics,
  studyArticles as seedStudyArticles,
  questions as seedQuestions,
  exams as seedExams,
  examResults as seedResults,
  examTracks as seedTracks,
  completedTopicIds as seedCompleted,
  subjectTally as seedTally,
  CONTENT_STATUS
} from '../data/studyData.js'
import { shorts as seedShorts, templates as seedTemplates, SHORT_STATUS } from '../data/shortsData.js'

/* ------------------------------------------------------------------ helpers */

let counter = 1000
const nextId = (prefix) => prefix + ++counter

const replace = (list, id, patch) =>
  list.map((item) => (item.id === id ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item))

/** Header counts always come from the blueprint — never typed in by hand. */
const withPaperTotals = (paper) => {
  const blueprint = paper.blueprint || []
  return {
    ...paper,
    subjectIds: blueprint.map((r) => r.subjectId),
    questionCount: blueprint.reduce((n, r) => n + Number(r.questions || 0), 0),
    totalMarks: blueprint.reduce((n, r) => n + Number(r.marks || 0), 0)
  }
}

const withTotals = (track) => ({
  ...track,
  totalQuestions: track.sections.reduce((s, x) => s + Number(x.questions || 0), 0),
  totalMarks: track.sections.reduce((s, x) => s + Number(x.marks || 0), 0)
})

/* -------------------------------------------------------------------- state */

/**
 * Everything that comes from Firestore starts EMPTY and is filled by the snapshot
 * listeners - see useFirestoreSync below. An empty console on first paint is
 * correct: it means nothing has loaded yet, or the project genuinely has no
 * content. The seed data that used to sit here showed articles and subjects that
 * existed nowhere but this file.
 *
 * What is NOT synced, and why:
 *   users     - desk accounts live in the Realtime Database, written by seeding
 *   settings  - presentation toggles, not content
 *   roles     - the permission matrix; a product definition, not data
 *   results / completedTopicIds / subjectTally - produced by students using the
 *               app, and students are anonymous, so there is nothing to read yet
 *   shorts / templates - the AI Shorts pipeline is not wired to Firestore yet
 */
const initialState = {
  // news — from Firestore
  categories: [],
  articles: [],
  // not synced
  users: seedUsers,
  settings: seedSettings,
  // ai shorts — not synced yet
  shorts: [],
  templates: seedTemplates,
  // study — from Firestore
  tracks: [],
  subjects: [],
  topics: [],
  studyArticles: [],
  questions: [],
  exams: [],
  // derived from use, so empty until students generate it
  results: [],
  completedTopicIds: [],
  subjectTally: [],
  // access control — editable role matrix driving the console
  roles: seedRoles,
  // audit trail — every admin action lands here
  activity: []
}

const logEntry = (state, message) => [
  { id: nextId('log_'), message, at: Date.now() },
  ...state.activity
].slice(0, 60)

function reducer(state, action) {
  // A server snapshot replacing one collection wholesale. Deliberately not
  // logged to the activity trail: this is Firestore telling us what is there,
  // not somebody doing something.
  if (action.type === 'hydrate') {
    return { ...state, [action.payload.key]: action.payload.rows }
  }

  const { type, payload } = action
  switch (type) {
    /* ------------------------------------------------------- news: articles */
    case 'article/startReview':
      return {
        ...state,
        articles: replace(state.articles, payload.id, (a) =>
          a.status === NEWS_STATUS.SUBMITTED ? { status: NEWS_STATUS.UNDER_REVIEW } : {}
        ),
        activity: logEntry(state, 'Opened for review: ' + payload.headline)
      }

    case 'article/saveEdits':
      return {
        ...state,
        articles: replace(state.articles, payload.id, payload.fields),
        activity: logEntry(state, 'Saved editor changes: ' + (payload.headline || L(payload.fields.headline)))
      }

    case 'article/approve':
      return {
        ...state,
        articles: replace(state.articles, payload.id, () =>
          payload.publish
            ? { status: NEWS_STATUS.PUBLISHED, publishedAt: Date.now(), updatedAt: Date.now(), rejectionReason: null, editorNote: null }
            : { status: NEWS_STATUS.APPROVED, updatedAt: Date.now(), rejectionReason: null, editorNote: null }
        ),
        activity: logEntry(
          state,
          (payload.publish ? 'Approved & published: ' : 'Approved (not live): ') + payload.headline
        )
      }

    case 'article/reject':
      return {
        ...state,
        articles: replace(state.articles, payload.id, {
          status: NEWS_STATUS.REJECTED,
          updatedAt: Date.now(),
          rejectionReason: lt(payload.reason, '')
        }),
        activity: logEntry(state, 'Rejected: ' + payload.headline)
      }

    case 'article/sendBack':
      return {
        ...state,
        articles: replace(state.articles, payload.id, {
          status: NEWS_STATUS.SENT_BACK,
          updatedAt: Date.now(),
          editorNote: lt(payload.note, '')
        }),
        activity: logEntry(state, 'Sent back to reporter: ' + payload.headline)
      }

    case 'article/publish':
      return {
        ...state,
        articles: replace(state.articles, payload.id, { status: NEWS_STATUS.PUBLISHED, publishedAt: Date.now(), updatedAt: Date.now() }),
        activity: logEntry(state, 'Published: ' + payload.headline)
      }

    case 'article/unpublish':
      return {
        ...state,
        articles: replace(state.articles, payload.id, { status: NEWS_STATUS.APPROVED }),
        activity: logEntry(state, 'Unpublished: ' + payload.headline)
      }

    case 'article/toggleBreaking':
      return {
        ...state,
        articles: replace(state.articles, payload.id, (a) => ({ isBreaking: !a.isBreaking })),
        activity: logEntry(state, 'Breaking flag changed: ' + payload.headline)
      }

    case 'article/toggleFeatured':
      return {
        ...state,
        articles: replace(state.articles, payload.id, (a) => ({ isFeatured: !a.isFeatured })),
        activity: logEntry(state, 'Pinned/unpinned: ' + payload.headline)
      }

    case 'article/clearReports':
      return {
        ...state,
        articles: replace(state.articles, payload.id, { reportCount: 0 }),
        activity: logEntry(state, 'Cleared reader reports: ' + payload.headline)
      }

    case 'article/remove':
      return {
        ...state,
        articles: state.articles.filter((a) => a.id !== payload.id),
        activity: logEntry(state, 'Removed article: ' + payload.headline)
      }

    case 'article/create': {
      const now = Date.now()
      const article = {
        id: nextId('n_'),
        tags: [],
        photoUrls: [],
        videoUrls: [],
        detailEnabled: true,
        notifyReaders: true,
        isBreaking: false,
        isFeatured: false,
        isTrending: false,
        views: 0,
        reportCount: 0,
        likes: 0,
        dislikes: 0,
        comments: 0,
        rejectionReason: null,
        editorNote: null,
        imageUrl: '',
        reporterAvatarUrl: '',
        createdAt: now,
        updatedAt: now,
        publishedAt: payload.fields.status === NEWS_STATUS.PUBLISHED ? now : null,
        ...payload.fields
      }
      return {
        ...state,
        articles: [article, ...state.articles],
        activity: logEntry(
          state,
          'Article created (' + article.status.toLowerCase() + '): ' + L(article.headline)
        )
      }
    }

    /* ----------------------------------------------------- news: categories */
    case 'category/save': {
      const { id, fields } = payload
      if (id) {
        return {
          ...state,
          categories: replace(state.categories, id, fields),
          activity: logEntry(state, 'Category updated: ' + L(fields.name))
        }
      }
      return {
        ...state,
        categories: [...state.categories, { id: nextId('cat_'), isEnabled: true, ...fields }],
        activity: logEntry(state, 'Category added: ' + L(fields.name))
      }
    }

    case 'category/toggle':
      return {
        ...state,
        categories: replace(state.categories, payload.id, (c) => ({ isEnabled: !c.isEnabled })),
        activity: logEntry(state, 'Category visibility changed: ' + payload.name)
      }

    case 'category/delete':
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== payload.id),
        activity: logEntry(state, 'Category deleted: ' + payload.name)
      }

    /* ------------------------------------------------------ news: reporters */
    case 'user/toggleActive':
      return {
        ...state,
        users: replace(state.users, payload.id, (u) => ({ isActive: !u.isActive })),
        activity: logEntry(state, 'Account activated/deactivated: ' + payload.name)
      }

    case 'user/save': {
      const { id, fields } = payload
      if (id) {
        return {
          ...state,
          users: replace(state.users, id, fields),
          activity: logEntry(state, 'User updated: ' + fields.name)
        }
      }
      return {
        ...state,
        users: [
          ...state.users,
          { id: nextId('u_'), isActive: true, joinedOn: 'Today', location: 'Hyderabad', ...fields }
        ],
        activity: logEntry(state, 'User added: ' + fields.name)
      }
    }

    /** An account can hold several roles at once — Reporter + Editor, say. */
    case 'user/setRoles':
      return {
        ...state,
        users: replace(state.users, payload.id, { roles: payload.roles }),
        activity: logEntry(
          state,
          payload.name + ' is now ' + (payload.roles.join(' + ') || 'unassigned')
        )
      }

    /** Set which editors own one reporter (a reporter may sit under one or two). */
    case 'user/assignEditors':
      return {
        ...state,
        users: replace(state.users, payload.id, { editorIds: payload.editorIds }),
        activity: logEntry(
          state,
          payload.name +
            ' assigned to ' +
            (payload.editorIds.length ? payload.editorIds.length + ' editor(s)' : 'no editor')
        )
      }

    /**
     * The same link seen from the owner's side — set that editor's reporters, or
     * that study editor's creators. memberRole says which side is being linked.
     */
    case 'user/assignReporters': {
      const { editorId, reporterIds, editorName } = payload
      return {
        ...state,
        users: state.users.map((u) => {
          if (!u.roles.includes(payload.memberRole || 'Reporter')) return u
          const has = u.editorIds.includes(editorId)
          const want = reporterIds.includes(u.id)
          if (has === want) return u
          return {
            ...u,
            editorIds: want
              ? [...u.editorIds, editorId]
              : u.editorIds.filter((id) => id !== editorId)
          }
        }),
        activity: logEntry(state, editorName + ' now owns ' + reporterIds.length + ' reporter(s)')
      }
    }

    case 'user/resetPassword':
      return {
        ...state,
        users: replace(state.users, payload.id, {
          mustChangePassword: true,
          passwordSetAt: 'Reset — not yet signed in'
        }),
        activity: logEntry(state, 'Temporary password reset for ' + payload.name)
      }

    case 'user/delete':
      return {
        ...state,
        // deleting an editor must not leave their id dangling on reporter records
        users: state.users
          .filter((u) => u.id !== payload.id)
          .map((u) =>
            u.editorIds.includes(payload.id)
              ? { ...u, editorIds: u.editorIds.filter((id) => id !== payload.id) }
              : u
          ),
        activity: logEntry(state, 'User deleted: ' + payload.name)
      }

    /* ------------------------------------------------------- system: roles */
    case 'role/save': {
      const { id, fields } = payload
      if (id) {
        return {
          ...state,
          roles: replace(state.roles, id, fields),
          activity: logEntry(state, 'Role updated: ' + fields.name)
        }
      }
      return {
        ...state,
        roles: [...state.roles, { id: nextId('role_'), isSystem: false, ...fields }],
        activity: logEntry(state, 'Role created: ' + fields.name)
      }
    }

    case 'role/togglePerm':
      return {
        ...state,
        roles: replace(state.roles, payload.id, (r) => ({
          perms: {
            ...r.perms,
            [payload.module]: {
              ...r.perms[payload.module],
              [payload.perm]: !r.perms[payload.module]?.[payload.perm]
            }
          }
        })),
        activity: logEntry(
          state,
          payload.name + ' → ' + payload.module + ' ' + payload.perm + ' changed'
        )
      }

    case 'role/setModule':
      return {
        ...state,
        roles: replace(state.roles, payload.id, (r) => ({
          perms: {
            ...r.perms,
            [payload.module]: PERMS.reduce((acc, k) => ({ ...acc, [k]: payload.on }), {})
          }
        })),
        activity: logEntry(
          state,
          payload.name + ': ' + payload.module + (payload.on ? ' full access' : ' no access')
        )
      }

    case 'role/delete':
      return {
        ...state,
        roles: state.roles.filter((r) => r.id !== payload.id),
        activity: logEntry(state, 'Role deleted: ' + payload.name)
      }

    case 'settings/update':
      return {
        ...state,
        settings: { ...state.settings, ...payload },
        activity: logEntry(state, 'System settings updated')
      }

    /* -------------------------------------------------------------- shorts */
    case 'short/create': {
      const short = {
        id: nextId('sh_'),
        newsId: payload.newsId,
        title: payload.title,
        status: SHORT_STATUS.DRAFT,
        templateId: state.templates.find((t) => t.isDefault)?.id || state.templates[0]?.id,
        voiceId: 'v_te_f',
        language: 'Telugu',
        durationSeconds: 30,
        createdBy: payload.by,
        createdAt: Date.now(),
        views: 0,
        scenes: []
      }
      return {
        ...state,
        shorts: [short, ...state.shorts],
        activity: logEntry(state, 'AI short drafted from: ' + payload.title)
      }
    }

    case 'short/generateScript':
      return {
        ...state,
        shorts: replace(state.shorts, payload.id, (s) => ({
          status: SHORT_STATUS.SCRIPT_READY,
          failureReason: undefined,
          scenes: s.scenes.length
            ? s.scenes
            : [
                { id: 's1', text: payload.headline, seconds: 10, mediaLabel: 'Stock clip s1' },
                { id: 's2', text: payload.description || 'Key details of the story.', seconds: 10, mediaLabel: 'Stock clip s2' },
                { id: 's3', text: 'Full story on J Voice.', seconds: 10, mediaLabel: 'Stock clip s3' }
              ]
        })),
        activity: logEntry(state, 'Script generated: ' + payload.title)
      }

    case 'short/updateScene':
      return {
        ...state,
        shorts: replace(state.shorts, payload.id, (s) => ({
          scenes: s.scenes.map((sc) => (sc.id === payload.sceneId ? { ...sc, ...payload.fields } : sc))
        }))
      }

    case 'short/addScene':
      return {
        ...state,
        shorts: replace(state.shorts, payload.id, (s) => ({
          scenes: [
            ...s.scenes,
            { id: 's' + (s.scenes.length + 1), text: 'New scene', seconds: 8, mediaLabel: 'Stock clip' }
          ]
        }))
      }

    case 'short/deleteScene':
      return {
        ...state,
        shorts: replace(state.shorts, payload.id, (s) => ({
          scenes: s.scenes.filter((sc) => sc.id !== payload.sceneId)
        }))
      }

    case 'short/update':
      return {
        ...state,
        shorts: replace(state.shorts, payload.id, payload.fields)
      }

    case 'short/setStatus':
      return {
        ...state,
        shorts: replace(state.shorts, payload.id, {
          status: payload.status,
          failureReason: payload.status === SHORT_STATUS.FAILED ? payload.reason : undefined
        }),
        activity: logEntry(state, 'AI short ' + payload.status.toLowerCase() + ': ' + payload.title)
      }

    case 'short/delete':
      return {
        ...state,
        shorts: state.shorts.filter((s) => s.id !== payload.id),
        activity: logEntry(state, 'AI short deleted: ' + payload.title)
      }

    case 'template/toggle':
      return {
        ...state,
        templates: replace(state.templates, payload.id, (t) => ({ isActive: !t.isActive })),
        activity: logEntry(state, 'Video template toggled: ' + payload.name)
      }

    case 'template/setDefault':
      return {
        ...state,
        templates: state.templates.map((t) => ({ ...t, isDefault: t.id === payload.id })),
        activity: logEntry(state, 'Default video template: ' + payload.name)
      }

    /* --------------------------------------------------- study: exam types */
    case 'track/save': {
      const { id, fields } = payload
      if (id) {
        return {
          ...state,
          tracks: state.tracks.map((t) => (t.id === id ? withTotals({ ...t, ...fields }) : t)),
          activity: logEntry(state, 'Exam type updated: ' + L(fields.name))
        }
      }
      return {
        ...state,
        tracks: [...state.tracks, withTotals({ id: nextId('track_'), isEnabled: true, ...fields })],
        activity: logEntry(state, 'Exam type added: ' + L(fields.name))
      }
    }

    case 'track/toggle':
      return {
        ...state,
        tracks: replace(state.tracks, payload.id, (t) => ({ isEnabled: !t.isEnabled })),
        activity: logEntry(state, 'Exam type visibility changed: ' + payload.name)
      }

    case 'track/delete':
      return {
        ...state,
        tracks: state.tracks.filter((t) => t.id !== payload.id),
        activity: logEntry(state, 'Exam type deleted: ' + payload.name)
      }

    /* ----------------------------------------------- study: subjects/topics */
    case 'subject/save': {
      const { id, fields } = payload
      if (id) {
        return {
          ...state,
          subjects: replace(state.subjects, id, fields),
          activity: logEntry(state, 'Subject updated: ' + L(fields.name))
        }
      }
      return {
        ...state,
        subjects: [...state.subjects, { id: nextId('sub_'), isEnabled: true, ...fields }],
        activity: logEntry(state, 'Subject added: ' + L(fields.name))
      }
    }

    case 'subject/toggle':
      return {
        ...state,
        subjects: replace(state.subjects, payload.id, (s) => ({ isEnabled: !s.isEnabled })),
        activity: logEntry(state, 'Subject visibility changed: ' + payload.name)
      }

    case 'subject/delete':
      return {
        ...state,
        subjects: state.subjects.filter((s) => s.id !== payload.id),
        activity: logEntry(state, 'Subject deleted: ' + payload.name)
      }

    case 'topic/save': {
      const { id, fields } = payload
      if (id) {
        return {
          ...state,
          topics: replace(state.topics, id, fields),
          activity: logEntry(state, 'Topic updated: ' + L(fields.name))
        }
      }
      const order =
        Math.max(0, ...state.topics.filter((t) => t.subjectId === fields.subjectId).map((t) => t.order)) + 1
      return {
        ...state,
        topics: [...state.topics, { id: nextId('t_'), isEnabled: true, order, ...fields }],
        activity: logEntry(state, 'Topic added: ' + L(fields.name))
      }
    }

    case 'topic/toggle':
      return {
        ...state,
        topics: replace(state.topics, payload.id, (t) => ({ isEnabled: !t.isEnabled })),
        activity: logEntry(state, 'Topic visibility changed: ' + payload.name)
      }

    case 'topic/delete':
      return {
        ...state,
        topics: state.topics.filter((t) => t.id !== payload.id),
        activity: logEntry(state, 'Topic deleted: ' + payload.name)
      }

    /* ------------------------------------------------------- study: content */
    case 'studyArticle/setStatus':
      return {
        ...state,
        studyArticles: replace(state.studyArticles, payload.id, { status: payload.status }),
        activity: logEntry(state, 'Study article ' + payload.status.toLowerCase() + ': ' + payload.title)
      }

    case 'studyArticle/save': {
      const { id, fields } = payload
      if (id) {
        return {
          ...state,
          studyArticles: replace(state.studyArticles, id, fields),
          activity: logEntry(state, 'Study article updated: ' + fields.title)
        }
      }
      return {
        ...state,
        studyArticles: [
          {
            id: nextId('a_'),
            createdAt: Date.now(),
            readingMinutes: 5,
            importantPoints: [],
            examples: [],
            content: '',
            description: '',
            ...fields
          },
          ...state.studyArticles
        ],
        activity: logEntry(state, 'Study article created: ' + fields.title)
      }
    }

    case 'studyArticle/delete':
      return {
        ...state,
        studyArticles: state.studyArticles.filter((a) => a.id !== payload.id),
        activity: logEntry(state, 'Study article deleted: ' + payload.title)
      }

    /* ------------------------------------------------- study: question bank */
    case 'question/save': {
      const { id, fields } = payload
      if (id) {
        return {
          ...state,
          questions: replace(state.questions, id, fields),
          activity: logEntry(state, 'Question updated')
        }
      }
      return {
        ...state,
        questions: [
          { id: nextId('q_'), type: 'Multiple choice', status: CONTENT_STATUS.PUBLISHED, ...fields },
          ...state.questions
        ],
        activity: logEntry(state, 'Question added')
      }
    }

    case 'question/delete':
      return {
        ...state,
        questions: state.questions.filter((q) => q.id !== payload.id),
        activity: logEntry(state, 'Question deleted')
      }

    /* --------------------------------------------------------- study: exams */
    case 'exam/save': {
      const { id, fields } = payload
      const paper = withPaperTotals(fields)
      if (id) {
        return {
          ...state,
          exams: replace(state.exams, id, paper),
          activity: logEntry(state, 'Exam updated: ' + paper.title)
        }
      }
      return {
        ...state,
        exams: [{ id: nextId('exam_'), ...paper }, ...state.exams],
        activity: logEntry(state, 'Exam created: ' + paper.title)
      }
    }

    case 'exam/toggleActive':
      return {
        ...state,
        exams: replace(state.exams, payload.id, (e) => ({ isActive: !e.isActive })),
        activity: logEntry(state, 'Exam activated/deactivated: ' + payload.title)
      }

    case 'exam/delete':
      return {
        ...state,
        exams: state.exams.filter((e) => e.id !== payload.id),
        activity: logEntry(state, 'Exam deleted: ' + payload.title)
      }

    default:
      return state
  }
}

/* ------------------------------------------------------------------ context */

const StoreContext = createContext(null)
const AuthContext = createContext(null)
const ToastContext = createContext(null)

/**
 * The console logins. Each one points at a real account in `users`, so a
 * signed-in editor sees their own reporters and a creator sees their own
 * drafts — the dashboards are driven by that account's assignments.
 */
export const LOGINS = [
  {
    role: 'Admin',
    userId: 'u_adm2',
    name: 'Ravi Teja Sharma',
    email: 'admin@jvoice.demo',
    blurb: 'Full control of both modules — create, edit, update and delete everywhere.',
    access: [
      'Reporters, editors and content creators — full CRUD',
      'Roles — build roles and tick every permission',
      'News pipeline, AI Shorts and categories',
      'Syllabus, study material, question bank, exams',
      'Results, users and platform settings'
    ]
  },
  {
    role: 'Editor',
    userId: 'u_ed1',
    name: 'Sridevi Naidu',
    email: 'sridevi@jvoice.demo',
    blurb: 'News desk. Reviews the queue from her own reporters and publishes.',
    access: [
      'Review queue — her sections and her reporters',
      'Edit headline, body, category and tags',
      'Approve, publish, reject or send back',
      'See her assigned reporters and their output',
      'No Study module, no people management, no settings'
    ]
  },
  {
    role: 'Reporter',
    userId: 'u_rep1',
    name: 'Kiran Kumar',
    email: 'kiran@jvoice.demo',
    blurb: 'Field reporter. Files stories to his editor and tracks what happened to them.',
    access: [
      'File a story — save a draft or send it to the review queue',
      'Track his own filings through the pipeline',
      'Read an editor rejection reason or send-back note, then resubmit',
      'No review queue — he cannot approve or publish, including his own work',
      'No Study module, no people management, no settings'
    ]
  },
  {
    role: 'Content Creator',
    userId: 'u_cc1',
    name: 'Sunitha Rao',
    email: 'sunitha@jvoice.demo',
    blurb: 'Owns the study side — writes material and questions, and publishes them.',
    access: [
      'Write, edit and publish study articles',
      'Build the question bank for her subjects, topic by topic',
      'Work through the topic workspace for each chapter',
      'Track drafts and published material',
      'No News module, no people management, no settings'
    ]
  }
]

/**
 * Keeps the store and Firestore in step.
 *
 * Hydration is one-way (server -> store) and write-back is diff-based
 * (store -> server). The `baselines` ref holds what the server last confirmed for
 * each collection, so our own writes echoing back through the listener are not
 * mistaken for fresh local edits - which would otherwise loop forever.
 *
 * `enabled` is the signed-in check, and it is not an optimisation. This store is
 * the CONSOLE's: it reads drafts and the question bank, which the rules close to
 * anonymous callers. Mounted for a signed-out visitor - which the public reader
 * now is - every one of those listeners is denied, filling the console with
 * permission warnings for a page that never wanted the data. The reader has its
 * own read-only feed in reader/publicFeed.js, scoped to what is public.
 */
function useFirestoreSync(state, dispatch, enabled) {
  const baselines = useRef(null)
  if (baselines.current === null) {
    baselines.current = Object.fromEntries(Object.keys(COLLECTIONS).map((k) => [k, new Map()]))
  }
  const previous = useRef(null)

  useEffect(() => {
    if (!isFirebaseReady() || !enabled) {
      // Forget what we thought the server held, so the next sign-in diffs
      // against a fresh snapshot rather than against a stale one.
      previous.current = null
      return
    }
    return subscribeAll((key, rows) => {
      recordBaseline(key, rows, baselines.current[key])
      dispatch({ type: 'hydrate', payload: { key, rows } })
    })
  }, [dispatch, enabled])

  useEffect(() => {
    const before = previous.current
    previous.current = state
    // Nothing to compare against on the very first render, and nothing to write
    // back when nobody is signed in.
    if (!before || !isFirebaseReady() || !enabled) return
    for (const key of Object.keys(COLLECTIONS)) {
      if (before[key] === state[key]) continue
      syncCollection(key, before[key], state[key], baselines.current[key])
    }
  }, [state, enabled])
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [session, setSession] = useState(null)
  const [toast, setToast] = useState(null)
  const [authReady, setAuthReady] = useState(!isFirebaseReady())

  useFirestoreSync(state, dispatch, Boolean(session))

  const notify = useCallback((message) => {
    setToast({ message, at: Date.now() })
    window.clearTimeout(notify._t)
    notify._t = window.setTimeout(() => setToast(null), 2600)
  }, [])

  /**
   * Restores a Firebase session on reload.
   *
   * Only real sessions are restored - a demo login is deliberately not
   * persisted, so refreshing the page during a demo returns to the login
   * screen rather than resuming as somebody.
   */
  useEffect(() => {
    if (!isFirebaseReady()) {
      setAuthReady(true)
      return
    }
    const unsubscribe = observeSession((restored) => {
      if (restored) setSession({ ...restored, isReal: true })
      setAuthReady(true)
    })
    return unsubscribe
  }, [])

  /**
   * The live revoke listener, mounted only for real sessions.
   *
   * Demo sessions have no uid to watch, and nothing server-side can revoke them.
   */
  useEffect(() => {
    if (!session?.isReal || !session.uid) return
    return watchForceLogout(session.uid, () => {
      setSession(null)
      notify('Your session was ended by the desk.')
    })
  }, [session?.isReal, session?.uid, notify])

  const auth = useMemo(
    () => ({
      session,
      authReady,
      firebaseReady: isFirebaseReady(),

      /** Demo sign-in: picks a persona from the local LOGINS list, no account. */
      signIn: (role) => setSession(LOGINS.find((l) => l.role === role) || LOGINS[0]),

      /**
       * Real sign-in. Resolves to the session, or throws with a message already
       * written for a human - see staffAuth.js.
       */
      signInStaff: async (loginId, password) => {
        const resolved = await signInStaff(loginId, password)
        setSession({ ...resolved, isReal: true })
        return resolved
      },

      signOut: () => {
        // Clearing local state first keeps the UI responsive; the remote write
        // and Firebase sign-out follow and are allowed to be slow.
        const wasReal = session?.isReal
        const uid = session?.uid
        setSession(null)
        if (wasReal) signOutStaff(uid)
      },

      isAdmin: session?.role === 'Admin',
      isEditor: session?.role === 'Editor',
      isCreator: session?.role === 'Content Creator',
      isReporter: session?.role === 'Reporter'
    }),
    [session, authReady]
  )

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      <AuthContext.Provider value={auth}>
        <ToastContext.Provider value={{ toast, notify }}>{children}</ToastContext.Provider>
      </AuthContext.Provider>
    </StoreContext.Provider>
  )
}

export const useStore = () => useContext(StoreContext)
export const useAuth = () => useContext(AuthContext)
export const useToast = () => useContext(ToastContext)

/* ---------------------------------------------------------------- selectors */

/** Union of the permission matrices for every role an account holds. */
export function effectivePerms(roleNames, roles) {
  const held = roles.filter((r) => roleNames.includes(r.name))
  const out = {}
  MODULES.forEach((m) => {
    out[m] = {}
    PERMS.forEach((k) => {
      out[m][k] = held.some((r) => r.perms[m]?.[k])
    })
  })
  return out
}

export function useSelectors() {
  const { state } = useStore()
  return useMemo(() => {
    const categoryName = (id) => L(state.categories.find((c) => c.id === id)?.name) || 'General'
    const subjectName = (id) => L(state.subjects.find((s) => s.id === id)?.name) || 'Subject'
    const subjectEmoji = (id) => state.subjects.find((s) => s.id === id)?.emoji || '📘'
    const topicName = (id) => L(state.topics.find((t) => t.id === id)?.name) || 'Topic'
    const userName = (id) => state.users.find((u) => u.id === id)?.name || 'Unknown'
    const withRole = (name) => state.users.filter((u) => u.roles.includes(name))
    const permsOf = (user) => effectivePerms(user.roles, state.roles)
    const trackName = (id) => state.tracks.find((t) => t.id === id)?.shortName || 'Exam'
    const articleById = (id) => state.articles.find((a) => a.id === id)
    const trackById = (id) => state.tracks.find((t) => t.id === id)

    const reviewQueue = state.articles.filter(
      (a) => a.status === NEWS_STATUS.SUBMITTED || a.status === NEWS_STATUS.UNDER_REVIEW
    )
    const published = state.articles.filter((a) => a.status === NEWS_STATUS.PUBLISHED)
    const approvedNotLive = state.articles.filter((a) => a.status === NEWS_STATUS.APPROVED)
    const reported = state.articles.filter((a) => a.reports > 0)

    const topicsOf = (subjectId) =>
      state.topics.filter((t) => t.subjectId === subjectId).sort((a, b) => a.order - b.order)
    const questionsOfSubject = (subjectId) => state.questions.filter((q) => q.subjectId === subjectId)
    const articlesOfSubject = (subjectId) => state.studyArticles.filter((a) => a.subjectId === subjectId)
    const examsOfTrack = (trackId) =>
      state.exams.filter((e) => e.trackIds.length === 0 || e.trackIds.includes(trackId))
    const papersTaggedTo = (trackId) => state.exams.filter((e) => e.trackIds.includes(trackId))
    const resultsOfTrack = (trackId) => state.results.filter((r) => r.trackId === trackId)

    /**
     * Questions the bank can actually supply for one blueprint row — published
     * only, narrowed to the chosen topics when the row names any.
     */
    const availableFor = (row) =>
      state.questions.filter(
        (q) =>
          q.subjectId === row.subjectId &&
          q.status === CONTENT_STATUS.PUBLISHED &&
          (!row.topicIds?.length || row.topicIds.includes(q.topicId))
      )

    /** Per-row shortfall for a paper, plus whether the paper can be built at all. */
    const paperCoverage = (paper) => {
      const rows = (paper.blueprint || []).map((row) => {
        const have = availableFor(row).length
        return { ...row, have, short: Math.max(0, Number(row.questions || 0) - have) }
      })
      return {
        rows,
        shortRows: rows.filter((r) => r.short > 0),
        shortTotal: rows.reduce((n, r) => n + r.short, 0),
        ready: rows.length > 0 && rows.every((r) => r.short === 0)
      }
    }

    /** Deterministic draw so the same paper previews the same way every time. */
    const drawPaper = (paper) =>
      (paper.blueprint || []).flatMap((row) =>
        availableFor(row).slice(0, Number(row.questions || 0))
      )

    const questionsOfTopic = (topicId) => state.questions.filter((q) => q.topicId === topicId)

    /**
     * A topic is split into practice sets rather than one long quiz. Set sizes
     * are deliberately uneven and the count follows the bank, so a thin topic
     * gets one set and a rich one gets several. Past-paper questions are kept
     * as their own set.
     */
    const SET_SIZES = [5, 3, 6, 4, 7]
    const quizSetsOfTopic = (topicId) => {
      const all = questionsOfTopic(topicId)
      const sample = all.filter((q) => q.source !== 'Previous Paper')
      const past = all.filter((q) => q.source === 'Previous Paper')

      const sets = []
      let cursor = 0
      let index = 0
      while (cursor < sample.length && index < SET_SIZES.length) {
        const size = SET_SIZES[index % SET_SIZES.length]
        const slice = sample.slice(cursor, cursor + size)
        if (!slice.length) break
        // a trailing single question joins the previous set rather than standing alone
        if (slice.length === 1 && sets.length) {
          sets[sets.length - 1].questions.push(...slice)
        } else {
          index += 1
          sets.push({
            id: topicId + '_s' + index,
            title: 'Set ' + index,
            questions: slice,
            isPast: false
          })
        }
        cursor += slice.length
      }

      if (past.length) {
        sets.push({ id: topicId + '_past', title: 'Previously asked', questions: past, isPast: true })
      }
      return sets
    }

    const subjectAccuracy = (subjectId) => {
      const pair = state.subjectTally[subjectId]
      if (!pair || !pair[1]) return null
      return Math.round((pair[0] * 100) / pair[1])
    }
    const band = (accuracy) =>
      accuracy === null ? null : accuracy >= 80 ? 'Strong' : accuracy >= 50 ? 'Needs Practice' : 'Weak'

    return {
      categoryName, subjectName, subjectEmoji, topicName, userName, trackName,
      withRole, permsOf,
      articleById, trackById,
      reviewQueue, published, approvedNotLive, reported,
      topicsOf, questionsOfSubject, articlesOfSubject, examsOfTrack, papersTaggedTo, resultsOfTrack,
      subjectAccuracy, band,
      availableFor, paperCoverage, drawPaper, questionsOfTopic, quizSetsOfTopic
    }
  }, [state])
}
