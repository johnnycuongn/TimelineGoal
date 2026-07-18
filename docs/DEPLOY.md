# TimelineGoal — Environments & Deployment Runbook

Three backends, one app:

| Env | Firebase project | Who uses it | How the app selects it |
|---|---|---|---|
| **dev** | local emulator suite (`demo-timelinegoal`) | Claude + you, day-to-day | default in `__DEV__` |
| **staging** | `timelinegoal-staging` (Spark, australia-southeast1) | TestFlight builds | `EXPO_PUBLIC_FIREBASE_ENV=staging` (pinned by the `staging` EAS profile) |
| **production** | `timelinegoal` (Spark, australia-southeast1) | App Store release | `EXPO_PUBLIC_FIREBASE_ENV=production` (pinned by the `production` EAS profile) |

Web configs for all three are committed in `src/lib/firebase.ts` (public values; the
only real secret is a service-account JSON, which never enters the repo).

**Build note**: store/TestFlight builds bundle their own runtime — the Expo Go
SDK-54 App Store cap does NOT apply. Build releases from `master` (SDK 57);
the `sdk54-expo-go` branch exists only for Expo Go testing on the iPhone.

---

## One-time setup — remaining manual steps

### A. Firebase console clicks (≈5 min per project, needs cuongdn2001@gmail.com)

Do each block for **both** projects: `timelinegoal-staging`, then `timelinegoal`.

1. **Firestore** — open
   `https://console.firebase.google.com/project/<PROJECT>/firestore`
   → Create database → **production mode** → location **australia-southeast1**.
   (This also enables the API; alternatively `gcloud auth login` as cuongdn2001
   then `gcloud services enable firestore.googleapis.com --project <PROJECT>`
   and re-run the CLI create.)
2. **Authentication** — open
   `https://console.firebase.google.com/project/<PROJECT>/authentication/providers`
   → enable **Email/Password**.
3. **Storage** — open
   `https://console.firebase.google.com/project/<PROJECT>/storage`
   → Get started → **production mode** → **australia-southeast1**.

Then tell Claude "consoles are enabled" and the rules deploy runs:

```bash
firebase deploy --only firestore:rules --project timelinegoal-staging
firebase deploy --only storage --project timelinegoal-staging
firebase deploy --only firestore:rules --project timelinegoal
firebase deploy --only storage --project timelinegoal
```

(Never bare `firebase deploy`; never enable Blaze — everything here fits Spark.)

### B. Apple (needs you)

1. **Apple Developer Program** — enroll at https://developer.apple.com/programs/enroll/
   with your Apple ID (US$99/year). **Required for TestFlight and the App Store** —
   a free Apple ID can only do 7-day cable installs via Xcode.
2. Wait for enrollment approval (usually < 48 h).

### C. Expo account (needs you)

```bash
npx expo login        # in your own terminal — interactive
```

Any free Expo account works (the old `duccuong0810` login was stale — fresh login is fine).

---

## Ship to TestFlight (staging)

From `master`, after A–C are done:

```bash
git checkout master
npx eas build --platform ios --profile staging
# first run asks: log into Apple, create the App Store Connect app record
# (bundle id com.timelinegoal.app), and generate signing credentials — accept the defaults.

npx eas submit --platform ios --latest
```

Then in App Store Connect → TestFlight: add yourself + your partner as internal
testers (internal = no Apple review wait). Both iPhones install via the TestFlight
app. Builds auto-increment their build number (`autoIncrement: true`).

**Exit test for staging**: the two of you live on the TestFlight build for a week
(M5 exit test) against `timelinegoal-staging` data.

## Ship to the App Store (production)

```bash
npx eas build --platform ios --profile production
npx eas submit --platform ios --latest
```

Then in App Store Connect: fill the listing (screenshots, description, privacy
labels — Firestore/Auth/Storage = "data linked to you": contact info, user content),
pick the build, submit for review. First review typically 1–3 days.

Android later: `eas build --platform android --profile production` → Play internal
track (needs a one-off Play Console account, US$25).

## Cutting over data

Staging and production are separate Firebase projects — accounts and couples do
not carry over. When you go live on the App Store build, you and your partner
sign up fresh on production and re-pair (one invite code). History starts clean.

## Rollback

TestFlight: expire the bad build in App Store Connect, testers reinstall previous.
App Store: "Remove from sale" or submit a fix build with expedited review.
Firestore data is never touched by app rollbacks (append-only check-ins).
