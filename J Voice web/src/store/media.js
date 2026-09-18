import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage'
import { getFirebaseApp } from '../firebase.js'

/**
 * Story media uploads to Firebase Storage.
 *
 * Photos go to `news-photos/`, videos to `news-videos/` - the folders the
 * storage rules open to the desk. The returned download URL is what gets
 * stored on the story; it carries its own access token, so the app and the
 * site fetch it directly with no further auth.
 *
 * File names are made unique with a timestamp so two reporters uploading
 * `IMG_0001.jpg` on the same day do not overwrite each other.
 */

export const PHOTO_MAX_BYTES = 15 * 1024 * 1024
export const VIDEO_MAX_BYTES = 300 * 1024 * 1024

const safeName = (name) => name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80)

/**
 * Uploads `file` under `folder` ('news-photos' | 'news-videos').
 * `onProgress(fraction)` is called as bytes go up. Resolves to the URL.
 */
export function uploadMedia(file, folder, onProgress) {
  const app = getFirebaseApp()
  if (!app) return Promise.reject(new Error('Firebase is not available'))
  const path = `${folder}/${Date.now()}-${safeName(file.name)}`
  const task = uploadBytesResumable(ref(getStorage(app), path), file, { contentType: file.type })
  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      () => getDownloadURL(task.snapshot.ref).then(resolve, reject)
    )
  })
}
