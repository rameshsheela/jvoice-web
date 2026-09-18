import { useRef, useState } from 'react'
import { PHOTO_MAX_BYTES, VIDEO_MAX_BYTES, uploadMedia } from '../store/media.js'

/**
 * The media section of a story form: one cover photo and any number of
 * videos, each either uploaded to Firebase Storage or pasted as a link.
 *
 * Uploads fill the URL in themselves when they finish, so the editor never
 * sees or copies a Storage link. A pasted link is for YouTube (the app shows
 * a thumbnail that opens YouTube) or a video already hosted elsewhere.
 *
 * `value` is `{ imageUrl, videoUrls }` and `onChange` gets the same shape.
 */
export default function MediaFields({ value, onChange }) {
  const imageUrl = value.imageUrl || ''
  const videoUrls = value.videoUrls || []
  const [photoState, setPhotoState] = useState({ busy: false, progress: 0, error: null })
  const [videoState, setVideoState] = useState({ busy: false, progress: 0, error: null })
  const [videoLink, setVideoLink] = useState('')
  const photoInput = useRef(null)
  const videoInput = useRef(null)

  const uploadPhoto = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setPhotoState({ busy: false, progress: 0, error: 'Choose an image file.' })
    if (file.size > PHOTO_MAX_BYTES) return setPhotoState({ busy: false, progress: 0, error: 'Photo must be under 15 MB.' })
    setPhotoState({ busy: true, progress: 0, error: null })
    try {
      const url = await uploadMedia(file, 'news-photos', (p) => setPhotoState((s) => ({ ...s, progress: p })))
      onChange({ ...value, imageUrl: url })
      setPhotoState({ busy: false, progress: 1, error: null })
    } catch (e) {
      setPhotoState({ busy: false, progress: 0, error: 'Upload failed: ' + e.message })
    }
  }

  const uploadVideo = async (file) => {
    if (!file) return
    if (!file.type.startsWith('video/')) return setVideoState({ busy: false, progress: 0, error: 'Choose a video file (mp4 recommended).' })
    if (file.size > VIDEO_MAX_BYTES) return setVideoState({ busy: false, progress: 0, error: 'Video must be under 300 MB.' })
    setVideoState({ busy: true, progress: 0, error: null })
    try {
      const url = await uploadMedia(file, 'news-videos', (p) => setVideoState((s) => ({ ...s, progress: p })))
      onChange({ ...value, videoUrls: [...videoUrls, url] })
      setVideoState({ busy: false, progress: 1, error: null })
    } catch (e) {
      setVideoState({ busy: false, progress: 0, error: 'Upload failed: ' + e.message })
    }
  }

  const addVideoLink = () => {
    const link = videoLink.trim()
    if (!link) return
    onChange({ ...value, videoUrls: [...videoUrls, link] })
    setVideoLink('')
  }

  const removeVideo = (i) => onChange({ ...value, videoUrls: videoUrls.filter((_, k) => k !== i) })

  return (
    <div className="media-fields">
      {/* ------------------------------------------------------------ photo */}
      <div className="media-block">
        <div className="media-head">
          <strong>Cover photo</strong>
          <span className="media-hint">Shown on the card and at the top of the story. JPG or PNG, under 15 MB.</span>
        </div>
        <div className="media-row">
          <div className="media-preview">
            {imageUrl ? <img src={imageUrl} alt="" /> : <span className="media-empty">No photo yet</span>}
          </div>
          <div className="media-actions">
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => uploadPhoto(e.target.files?.[0])}
            />
            <button type="button" className="primary small" onClick={() => photoInput.current?.click()} disabled={photoState.busy}>
              {photoState.busy ? `Uploading ${Math.round(photoState.progress * 100)}%` : imageUrl ? 'Replace photo' : 'Upload photo'}
            </button>
            {imageUrl ? (
              <button type="button" className="small ghost" onClick={() => onChange({ ...value, imageUrl: '' })}>
                Remove
              </button>
            ) : null}
            <input
              type="text"
              className="media-link"
              placeholder="…or paste an image link"
              value={imageUrl.startsWith('https://firebasestorage') ? '' : imageUrl}
              onChange={(e) => onChange({ ...value, imageUrl: e.target.value })}
            />
            {photoState.busy ? <Progress value={photoState.progress} /> : null}
            {photoState.error ? <div className="field-error">{photoState.error}</div> : null}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- videos */}
      <div className="media-block">
        <div className="media-head">
          <strong>Videos</strong>
          <span className="media-hint">
            Upload an mp4 (plays inside the app) or paste a YouTube link (opens in YouTube). The first video
            plays in the photo's place.
          </span>
        </div>
        {videoUrls.length ? (
          <ul className="media-list">
            {videoUrls.map((url, i) => (
              <li key={url + i}>
                <span className="media-kind">{isYouTube(url) ? 'YouTube' : 'Video'}</span>
                <span className="media-url" title={url}>{shorten(url)}</span>
                <button type="button" className="small ghost" onClick={() => removeVideo(i)}>Remove</button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="media-actions media-actions-row">
          <input
            ref={videoInput}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => uploadVideo(e.target.files?.[0])}
          />
          <button type="button" className="primary small" onClick={() => videoInput.current?.click()} disabled={videoState.busy}>
            {videoState.busy ? `Uploading ${Math.round(videoState.progress * 100)}%` : 'Upload video'}
          </button>
          <input
            type="text"
            className="media-link"
            placeholder="…or paste a YouTube / video link"
            value={videoLink}
            onChange={(e) => setVideoLink(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVideoLink() } }}
          />
          <button type="button" className="small" onClick={addVideoLink} disabled={!videoLink.trim()}>Add link</button>
        </div>
        {videoState.busy ? <Progress value={videoState.progress} /> : null}
        {videoState.error ? <div className="field-error">{videoState.error}</div> : null}
      </div>
    </div>
  )
}

function Progress({ value }) {
  return (
    <div className="media-progress" role="progressbar" aria-valuenow={Math.round(value * 100)}>
      <div style={{ width: Math.round(value * 100) + '%' }} />
    </div>
  )
}

const isYouTube = (url) => /(^|\/\/)(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url)

function shorten(url) {
  try {
    const u = new URL(url)
    const last = decodeURIComponent(u.pathname.split('/').pop() || '').replace(/^news-videos\//, '')
    return isYouTube(url) ? u.hostname + u.pathname + u.search : last || u.hostname
  } catch {
    return url
  }
}
