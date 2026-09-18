import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Outlet, useParams } from 'react-router-dom'
import { JVoiceMark } from '../components/Logo.jsx'
import { L, ltList } from '../i18n/localized.js'
import { useAuth } from '../store/store.jsx'
import { relativeTime } from '../components/ui.jsx'
import { byNewest, usePublicFeed } from './publicFeed.js'
import './reader.css'

/* ------------------------------------------------------------------ language */

const LANG_KEY = 'jvoice.reader.lang'

/**
 * The reading language, shared down the reader tree.
 *
 * Every content field in Firestore is a `{en, te}` pair, so switching language is
 * a render concern only — nothing is refetched. `L()` falls back to the other
 * language when one side is untranslated, which is why a Telugu-only story still
 * appears in the English feed instead of showing as a blank card.
 */
const LangContext = createContext({ lang: 'en', setLang: () => {} })
const useLang = () => useContext(LangContext)

function readStoredLang() {
  try {
    const saved = window.localStorage.getItem(LANG_KEY)
    return saved === 'te' || saved === 'en' ? saved : 'en'
  } catch {
    // Private windows and blocked site data both throw here; English is fine.
    return 'en'
  }
}

/* --------------------------------------------------------------------- shell */

const FeedContext = createContext(null)
export const useFeed = () => useContext(FeedContext)

/**
 * The public reader: header, the routed page, and the footer.
 *
 * One feed subscription lives here rather than in each page, so moving between
 * the landing page and a story re-renders from cache instead of refetching.
 */
export function ReaderShell() {
  const feed = usePublicFeed()
  const [lang, setLangState] = useState(readStoredLang)
  const { session } = useAuth()

  const setLang = (next) => {
    setLangState(next)
    try {
      window.localStorage.setItem(LANG_KEY, next)
    } catch {
      // Remembering the choice is a convenience; failing to is not an error.
    }
  }

  const langValue = useMemo(() => ({ lang, setLang }), [lang])

  return (
    <LangContext.Provider value={langValue}>
      <FeedContext.Provider value={feed}>
        <div className="reader">
          <header className="rd-top">
            <Link to="/" className="rd-brand">
              <JVoiceMark size={36} />
              <span>
                <span className="rd-brand-name">J Voice</span>
                <span className="rd-brand-sub">Telugu news &amp; exam prep</span>
              </span>
            </Link>

            <span className="rd-spacer" />

            <div className="rd-langs" role="group" aria-label="Reading language">
              <button
                className={lang === 'en' ? 'rd-lang on' : 'rd-lang'}
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
              >
                English
              </button>
              <button
                className={lang === 'te' ? 'rd-lang on' : 'rd-lang'}
                onClick={() => setLang('te')}
                aria-pressed={lang === 'te'}
              >
                తెలుగు
              </button>
            </div>

            {session ? (
              <Link className="rd-signin" to="/console">
                Open console
              </Link>
            ) : (
              <Link className="rd-signin" to="/login">
                Login
              </Link>
            )}
          </header>

          <Outlet />

          <footer className="rd-foot">
            <div className="rd-foot-in">
              <div>
                <strong>J Voice</strong> — Telugu news and competitive-exam preparation.
              </div>
              <span className="rd-spacer" />
              <Link to="/contact">Contact us</Link>
              <Link to="/privacy-policy">Privacy policy</Link>
              <Link to="/login">Staff &amp; admin console</Link>
            </div>
          </footer>
        </div>
      </FeedContext.Provider>
    </LangContext.Provider>
  )
}

/* -------------------------------------------------------------------- video */

/**
 * The video id from any of YouTube's link shapes, or null for a non-YouTube
 * link - a direct file, typically a Firebase Storage download URL.
 */
function youtubeVideoId(url) {
  let u
  try {
    u = new URL(url.trim())
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '')
  const parts = u.pathname.split('/').filter(Boolean)
  let id = null
  if (host === 'youtu.be') id = parts[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (parts[0] === 'watch') id = u.searchParams.get('v')
    else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) id = parts[1]
  }
  return id && /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null
}

/**
 * A story video. A YouTube link is shown as YouTube's thumbnail that opens
 * the video on YouTube - embeds are unreliable (region, ads, "unavailable")
 * and the app does the same, so readers get one behaviour everywhere. A file
 * URL (Firebase Storage) plays in the browser's own player.
 */
function ArticleVideo({ url }) {
  const id = youtubeVideoId(url)
  if (id) {
    return (
      <a
        className="rd-video rd-video-yt"
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="Watch on YouTube" />
        <span className="rd-video-badge">▶ Watch on YouTube</span>
      </a>
    )
  }
  return (
    <div className="rd-video">
      <video src={url} controls preload="metadata" playsInline />
    </div>
  )
}

/* --------------------------------------------------------------------- cards */

function Thumb({ article, tall }) {
  const { lang } = useLang()
  if (!article.imageUrl) {
    return (
      <div className={tall ? 'rd-thumb rd-thumb-tall rd-thumb-blank' : 'rd-thumb rd-thumb-blank'}>
        <JVoiceMark size={40} />
      </div>
    )
  }
  return (
    <img
      className={tall ? 'rd-thumb rd-thumb-tall' : 'rd-thumb'}
      src={article.imageUrl}
      alt={L(article.headline, lang)}
      loading="lazy"
    />
  )
}

/**
 * When a story went out.
 *
 * Returns null rather than a date for a story with no timestamp: `relativeTime(0)`
 * renders "01 Jan 1970", and a wrong date on a byline is worse than none.
 */
function whenLabel(article) {
  const at = article.publishedAt || article.createdAt
  return at ? relativeTime(at) : null
}

function Flags({ article }) {
  return (
    <>
      {article.isBreaking ? <span className="rd-flag breaking">Breaking</span> : null}
      {article.isTrending ? <span className="rd-flag trending">Trending</span> : null}
    </>
  )
}

function ArticleCard({ article, categoryName, featured }) {
  const { lang } = useLang()
  return (
    <Link className={featured ? 'rd-card rd-card-lead' : 'rd-card'} to={`/read/${article.id}`}>
      <Thumb article={article} tall={featured} />
      <div className="rd-card-body">
        <div className="rd-card-meta">
          <span className="rd-cat">{categoryName(article.categoryId)}</span>
          <Flags article={article} />
        </div>
        <h3>{L(article.headline, lang)}</h3>
        <p>{L(article.shortDescription, lang)}</p>
        <div className="rd-byline">
          {article.reporterName ? <span>{article.reporterName}</span> : null}
          {article.location ? <span>· {article.location}</span> : null}
          {whenLabel(article) ? <span>· {whenLabel(article)}</span> : null}
        </div>
      </div>
    </Link>
  )
}

/* ------------------------------------------------------------------ article */

export function ReaderArticle() {
  const { id } = useParams()
  const feed = useFeed()
  const { lang } = useLang()

  const article = feed.articles.find((a) => a.id === id)

  // Scroll to the top on navigation — the router keeps the scroll position, which
  // otherwise drops the reader halfway down a story they have not started.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  if (feed.status === 'loading') {
    return (
      <main className="rd-main">
        <div className="rd-note">Loading…</div>
      </main>
    )
  }
  // Missing once the feed has settled means unpublished, deleted, or a bad link.
  if (!article) return <Navigate to="/" replace />

  const categoryName =
    L(feed.categories.find((c) => c.id === article.categoryId)?.name, lang) || 'General'
  const paragraphs = L(article.content, lang)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const tags = ltList(article.tags, lang)

  const related = feed.articles
    .filter((a) => a.id !== article.id && a.categoryId === article.categoryId)
    .sort(byNewest)
    .slice(0, 3)

  return (
    <main className="rd-main rd-read">
      <Link className="rd-back" to="/">
        ← All news
      </Link>

      <article className="rd-article">
        <div className="rd-card-meta">
          <span className="rd-cat">{categoryName}</span>
          <Flags article={article} />
        </div>

        <h1>{L(article.headline, lang)}</h1>
        <p className="rd-standfirst">{L(article.shortDescription, lang)}</p>

        <div className="rd-byline rd-byline-lg">
          {article.reporterAvatarUrl ? (
            <img className="rd-avatar" src={article.reporterAvatarUrl} alt="" />
          ) : null}
          {article.reporterName ? <span>{article.reporterName}</span> : null}
          {article.location ? <span>· {article.location}</span> : null}
          {whenLabel(article) ? <span>· {whenLabel(article)}</span> : null}
        </div>

        {article.imageUrl ? (
          <img className="rd-hero" src={article.imageUrl} alt={L(article.headline, lang)} />
        ) : null}

        <div className="rd-body">
          {paragraphs.length ? (
            paragraphs.map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <p className="rd-note">This story has no body in the selected language yet.</p>
          )}
        </div>

        {article.videoUrls?.length ? (
          <div className="rd-videos">
            {article.videoUrls.filter(Boolean).map((url) => (
              <ArticleVideo key={url} url={url} />
            ))}
          </div>
        ) : null}

        {article.photoUrls?.length ? (
          <div className="rd-photos">
            {article.photoUrls.map((url) => (
              <img key={url} src={url} alt="" loading="lazy" />
            ))}
          </div>
        ) : null}

        {tags.length ? (
          <div className="rd-tags">
            {tags.map((t) => (
              <span className="rd-tag" key={t}>
                #{t}
              </span>
            ))}
          </div>
        ) : null}
      </article>

      {related.length ? (
        <section className="rd-section">
          <h2>More in {categoryName}</h2>
          <div className="rd-grid">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} categoryName={() => categoryName} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
