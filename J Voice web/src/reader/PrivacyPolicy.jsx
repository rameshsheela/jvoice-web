/**
 * The privacy policy, at `/privacy-policy`.
 *
 * Public and account-free like the rest of the reader, and rendered in the
 * reader shell so it carries the same header and footer. Play Store listings
 * link here, so the URL must stay stable: https://jvoicetelugu.com/privacy-policy
 *
 * The text describes what the app actually does today - a device id, an
 * optional name, a city, a language and reading activity, all in Firebase -
 * and nothing it does not. Keep it that way when the app changes.
 */

const CONTACT_EMAIL = 'privacy@jvoicetelugu.com'
const LAST_UPDATED = '17 September 2026'

export default function PrivacyPolicy() {
  return (
    <main className="rd-main">
      <article className="rd-article rd-policy">
        <p className="rd-kicker">Legal</p>
        <h1>Privacy Policy</h1>
        <p className="rd-meta">J Voice · Last updated {LAST_UPDATED}</p>

        <div className="rd-body">
          <p>
            J Voice ("we", "us") publishes Telugu and English news and competitive-exam
            preparation material through the J Voice Android app and the website at
            jvoicetelugu.com (together, the "Service"). This policy explains what
            information the Service collects, why, and what choices you have.
          </p>

          <h2>1. You do not need an account</h2>
          <p>
            Readers use J Voice without signing up. We do not ask for your phone number,
            email address or any government identity. Staff accounts exist only for our
            reporters, editors and administrators.
          </p>

          <h2>2. Information we collect</h2>
          <p>
            <strong>Device identifier.</strong> The app uses the Android device identifier
            (ANDROID_ID) to remember your preferences and to keep counts honest - for
            example, so one device can like a story only once. It is not linked to your
            name, phone number or any account.
          </p>
          <p>
            <strong>Your profile, if you set one.</strong> You may add a display name and
            choose a location (city) and a reading language in the Profile screen. These
            are optional. The name you choose is shown beside the comments you post.
          </p>
          <p>
            <strong>Reading activity.</strong> When you read, like or dislike a story, post
            a comment or reply, or report a story to our desk, that action is stored
            together with your device identifier and the name and location on your
            profile. Story views are counted in aggregate.
          </p>
          <p>
            <strong>Notification permission.</strong> If you allow notifications, the
            operating system records that permission so we can send breaking-news alerts.
            You can withdraw it at any time in the app's Profile screen or in Android
            settings.
          </p>
          <p>
            <strong>Technical information.</strong> Like any internet service, our servers
            receive standard connection data such as your IP address and app version when
            the app talks to them.
          </p>

          <h2>3. How we use it</h2>
          <ul>
            <li>To show you news for your chosen location in your chosen language.</li>
            <li>To display likes, comments and view counts to all readers.</li>
            <li>To let our editorial desk act on stories that readers report.</li>
            <li>To remember your preferences across app updates and reinstalls.</li>
            <li>To keep the Service working and to prevent abuse.</li>
          </ul>
          <p>We do not sell your information and we do not use it for advertising profiles.</p>

          <h2>4. Where it is stored</h2>
          <p>
            The Service is built on Google Firebase (Firestore, Realtime Database, Hosting
            and Authentication). Information you provide is stored on Google's
            infrastructure and is subject to Google's security practices. Your preferences
            are also kept on your own device so the app works offline.
          </p>

          <h2>5. What other readers can see</h2>
          <p>
            Comments and replies you post are public and appear with your display name (or
            "Reader" if you have not set one). Likes, dislikes and view counts are shown in
            aggregate. Your device identifier and location are never shown to other readers.
          </p>

          <h2>6. Retention and deletion</h2>
          <p>
            Preferences stay for as long as they are useful to you. Comments remain with
            the story they belong to. Reports are kept for our editorial records. To have
            comments or profile data associated with your device removed, write to us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>; clearing the app's
            data on your device removes the local copy and resets your device's profile.
          </p>

          <h2>7. Children</h2>
          <p>
            The Service is intended for readers aged 13 and above. We do not knowingly
            collect information from children under 13; if you believe a child has provided
            information to us, contact us and we will remove it.
          </p>

          <h2>8. Changes to this policy</h2>
          <p>
            We may update this policy as the Service changes. The date at the top shows
            when it was last revised; material changes will be announced in the app.
          </p>

          <h2>9. Contact</h2>
          <p>
            Questions about this policy or your information:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </article>
    </main>
  )
}
