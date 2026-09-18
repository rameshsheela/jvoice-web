# J Voice · Firebase

Project **`jvoice-b4b2e`** (number `180885422721`), created by the owner and wired
up here. Both clients are registered and both databases are chosen:

| | |
|---|---|
| Android app | `com.jvoice.news` — `1:180885422721:android:cb5a5b8aa4af6514234380` |
| Web app | J Voice Admin Console — `1:180885422721:web:5e2129cef208caf1234380` |
| Realtime Database | `jvoice-b4b2e-default-rtdb`, **asia-southeast1** — auth + session signals |
| Firestore | reserved for content, **not enabled yet** |

## Seeding the desk accounts

Email/Password auth is enabled on the project — a signed-out probe against
`accounts:signInWithPassword` returns `INVALID_LOGIN_CREDENTIALS`, not
`CONFIGURATION_NOT_FOUND`, which is how you tell the two apart without opening
the console.

```bash
cd firebase
npm install            # once
node seed-staff.mjs    # creates the desk accounts, prints passwords once
```

## Why RTDB for auth and Firestore for content

The session mechanics are all *listeners on single scalars* — `isLogin`,
`forceLogoutAt`. RTDB value events are the natural fit and the SafeTrack pattern
this follows is built on them. The content (articles, study material, question
bank) needs real queries — by status, by category, by topic — which is Firestore's
strength and RTDB's weakness. Splitting them costs one extra SDK and buys the
right tool on each side.

## How sign-in works

Modelled on the SafeTrack console, deliberately, so the two products behave the
same way for whoever operates both.

```
staff types "kiran" + password
   ↓  expanded to kiran@jvoicenews.com          (LoginViewModel.toEmail / firebase.js toEmail)
Firebase Auth signInWithEmailAndPassword
   ↓  uid
read users/{uid}  →  role                        (JvRole.fromCode)
   ↓
cache session on device                          (SessionStore / AuthProvider)
   ↓
set isLogin = true, stamp lastLoginAt
   ↓
route by role
```

On **relaunch** credentials are not re-validated — that round trip is the single
most noticeable startup cost. The cached session is trusted and only two cheap
server checks run:

1. **`isLogin`** — the launch kill-switch (`AuthGate.isAccountEnabled`)
2. **`update/{force,version}`** — the version gate (`AppUpdateGate`)

Both **fail open**: a network blip must not lock out a valid session.

The gap that leaves — a revoked account keeping its session until next launch —
is what **`forceLogoutAt`** closes. `ForceLogoutGuard` watches it live and ends
the session mid-use.

> **`forceLogoutAt` listeners skip their first snapshot, and must.** The value is
> never cleared, so someone force-logged-out last week still has a non-zero value
> today. Acting on the value present at attach time signs them out the instant
> they sign back in — a correct password appears to do nothing.

## Where the code lives

**Android** — `app/src/main/java/com/jvoice/core/`

| File | |
|---|---|
| `auth/JvRole.kt` | the one `role` string ↔ the app's two role enums |
| `auth/JvUser.kt` | the `users/{uid}` record |
| `auth/SessionStore.kt` | the cached session |
| `auth/AuthGate.kt` | kill-switch, and the correct logout ordering |
| `auth/LoginViewModel.kt` | sign-in, `@jvoicenews.com` expansion, failed attempts |
| `auth/ForceLogoutGuard.kt` | the live revoke listener |
| `auth/AppUpdateGate.kt` | the version gate |
| `auth/DeskSessionGate.kt` | the launch sequence |
| `auth/StaffLoginScreen.kt` | the form (bilingual) |
| `firebase/FirebaseAvailability.kt` | the "is Firebase usable" guard |

**Web** — `J Voice web/src/`

| File | |
|---|---|
| `firebase.js` | init; the config is public by design |
| `store/staffAuth.js` | sign-in, role→persona mapping, force-logout watch |
| `store/store.jsx` | `AuthProvider` — real sign-in *and* the demo personas |
| `pages/Login.jsx` | the form |

### The build works without `google-services.json`

The google-services Gradle plugin hard-fails when that file is missing, which
would mean nobody could compile the project before the Firebase project existed.
So `app/build.gradle.kts` applies it **conditionally** and mirrors the answer into
`BuildConfig.HAS_FIREBASE_CONFIG`; `FirebaseAvailability` reads that and falls
back to the local demo logins. Dropping the file in is the only step needed to
switch over — no code or Gradle edit.

## Security rules

`database.rules.json`, deployed and probed. **Default deny** — the root has no
`.read`/`.write`, so any unlisted path is closed.

> This is the opposite of the SafeTrack project, whose rules are `".read": true,
> ".write": true` at the root — every record there is world-readable. That was not
> copied.

**The rule that matters most** is on `users/$uid/role`: a signed-in user may write
`isLogin` and `lastLoginAt` on their own record but **not** `role`. Without that
carve-out any reporter could promote themselves to `super_admin` in one write and
every other check becomes decoration.

`failedLoginAttempts` and `passwordResetRequests` allow **unauthenticated writes**,
which is not an oversight: whoever needs them has by definition failed to sign in.
Abuse is bounded three other ways — write-only (no read, so they cannot be mined
for valid login IDs), strict shape validation, and a device/phone key so repeats
update one record instead of growing the tree.

Verified against the live database:

| probe | result |
|---|---|
| anonymous read `/users` | denied |
| anonymous read `/users/{uid}` | denied |
| anonymous write `/users/attacker` with `role: super_admin` | denied |
| anonymous read `/failedLoginAttempts` | denied |
| anonymous write a well-formed failed attempt | **allowed** (by design) |
| write a failed attempt **with a `password` field** | denied |
| write junk to `failedLoginAttempts` | denied |

That last pair is deliberate. **SafeTrack stores the attempted password in
plaintext** under `failedLoginAttempts` — its own module docs flag it — and this
schema rejects the field outright. Recording *that* a login failed helps the desk;
recording what was typed leaks near-misses of real passwords.

## Roles

`JvRole.code` in Kotlin, the regex in `database.rules.json`, `ROLE_TO_PERSONA` in
`staffAuth.js`, and `STAFF[].role` in `seed-staff.mjs` are the same list. Changing
one means changing all four.

| code | Android | Web console |
|---|---|---|
| `reporter` | Reporter | — *(files from the app; no console surface)* |
| `editor` | Editor | Editor |
| `news_admin` | News Admin | Admin |
| `content_creator` | Content Creator | Content Creator |
| `exam_admin` | Exam Admin | Admin |
| `study_admin` | Study Admin | Admin |
| `super_admin` | both modules | Admin |

**Readers and students have no accounts.** They enter anonymously from the landing
screen and their state lives on the device — so there is no `reader` or `student`
code, and `JvRole.fromCode` rejects them. An account whose role is "reader" is a
data error, not a login, and failing loudly beats granting a desk session.

`reporter` mapping to no console persona is also deliberate: silently promoting it
to Editor would hand a reporter the review queue.

## Custom domain

The site is on Firebase Hosting at <https://jvoice-b4b2e.web.app>. The domain
**`jvoicetelugu.com`** is registered at GoDaddy and points at it.

Firebase has **no CLI command for custom domains** — `firebase hosting:*` covers
sites and channels only. Adding one is console work, then DNS work at GoDaddy.

### 1 · Claim the domain in Firebase

<https://console.firebase.google.com/project/jvoice-b4b2e/hosting/sites>
→ **Add custom domain** → `jvoicetelugu.com` → tick *redirect www to the root*.

Firebase then shows a **TXT** record to prove ownership, and after verification
two **A** records to serve traffic.

### 2 · Add the records at GoDaddy

GoDaddy → *My Products* → the domain → **DNS** → *Add record*. GoDaddy writes
`@` for the root, so paste `@` where Firebase shows the bare domain.

| Type | Name | Value | Note |
|---|---|---|---|
| TXT | `@` | the `google-site-verification=…` string Firebase gives you | verification only, keep it |
| A | `@` | `199.36.158.100` | Firebase Hosting |
| A | `@` | `199.36.153.5` | second Firebase A record, add both |
| CNAME | `www` | `jvoice-b4b2e.web.app` | only if you did not let Firebase own `www` |

Two traps specific to GoDaddy:

- Delete GoDaddy's **parking A record** on `@` first. Leaving it in place means
  DNS round-robins between the parking page and the real site, which looks like
  an intermittent outage rather than a misconfiguration.
- GoDaddy's default TTL is 1 hour. Drop it to 600s *before* the change so a
  mistake is cheap to undo, and raise it once the certificate is issued.

Verification usually lands within the hour; the TLS certificate can take up to
24. The domain shows **Needs setup → Pending → Connected** in the console.

### 3 · Authorise the domain for sign-in

**This is the step that gets forgotten**, and its symptom is the staff login
failing on the custom domain while it still works on `*.web.app`. Firebase Auth
rejects a sign-in from any origin not on its allow-list.

<https://console.firebase.google.com/project/jvoice-b4b2e/authentication/settings>
→ **Authorized domains** → add `jvoicetelugu.com` and `www.jvoicetelugu.com`.

`authDomain` in `J Voice web/src/firebase.js` stays `jvoice-b4b2e.firebaseapp.com`
— that is the auth handler's own host and is unrelated to where the site is served.

## Push notifications

The desk's **Send notification to readers** switch (New article / Review story
in the console) decides whether publishing a story writes a `newsNotifications`
document. That document is two things at once:

1. the entry in the app's Notifications tab, which it always was;
2. the trigger for `pushNewsNotification` in `functions/index.js`, which relays
   it to the FCM topic `news` as a data-only message. Every reader device
   subscribes to that topic on launch (`core/push/NewsPush.kt`), draws the
   alert in the reader's own language, and opens the story on tap.

Cloud Functions need the **Blaze** plan (the project is on it; the function is deployed in `asia-south1`). To redeploy after a change:

```bash
cd firebase/functions && npm install
cd ../.. && firebase deploy --only functions --project jvoice-b4b2e
```

If the function is ever down the switch still works - readers just see the
story in the Notifications tab rather than the status bar.

## Commands

```bash
# rules
npm run deploy:db-rules            # RTDB only (Firestore not enabled yet)
npm run deploy:rules               # both, once Firestore is on

# accounts
npm run seed:dry                   # print the plan, write nothing
npm run seed                       # create/update, keep existing passwords
npm run seed:reset-passwords       # also reset passwords

# inspect
firebase database:get "/" --project jvoice-b4b2e
```

On Git Bash, prefix database paths with `MSYS_NO_PATHCONV=1` — otherwise `/` is
rewritten into a Windows path and the CLI reports *"Path must begin with /"*.

Credentials for the seeder come from Application Default Credentials
(`gcloud auth application-default login`), so no service-account key is needed or
committed.
