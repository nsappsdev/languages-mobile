# Language mobile reader

Expo Router / React Native client for published text and audio lessons. Authentication, profile, settings, native projects, and EAS configuration are retained; the legacy task runner and spelling-based vocabulary implementation have been replaced by `src/features/reader`.

## Local development

Use Node 22 or newer and the committed npm lockfile:

```sh
npm ci
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:4000/api npm run web
```

Use `npm start` for Expo device development. The API URL must be reachable from the device. Add the actual web origin to the local backend CORS allowlist. Never put provider keys in `EXPO_PUBLIC_*` variables. Existing `.env` files and EAS production configuration are not changed by the reader refactor.

The backend needs the `20260917090000_learner_text_releases` migration. In admin, save a text, generate and review narration/alignment, choose learning occurrences, add translations, extract clips, and approve each text. Then use the separate **Publish to mobile** action. Approval alone does not publish a lesson. Older approvals without an immutable manifest need to be approved again.

## Reader behavior

- Lessons list only explicitly published manifests; `/runner/[lessonId]` is the single reader.
- Sentences retain punctuation and use real narration sample boundaries. Selected occurrences open contextual meanings and clips cut from that narration.
- Listen plays the narration; Practice repeats occurrences marked for practice; Deep learning repeats sentences according to saved settings. There are no provider requests from mobile.
- Word repetition counts mean isolated practice plays before the word is heard naturally in context. The main narration stays parked before the word while a second player uses the occurrence clip already extracted from that same narration. The configured pause applies before the drill, between every practice play, and before narration resumes at the word. Deep learning runs that word drill once, then uses the secondary player for configured full-sentence replays while the main narration keeps its forward position. A visible counter shows the active play/replay; pausing retains the current step and sample position.
- Words use text release and occurrence IDs, so equal spellings remain independent. Saved states are New, Learning, and Learned.
- One playback controller owns separate narration and drill players, pauses both at every handoff, and cancels both on mode changes, navigation, and backgrounding.
- Asset downloads are authenticated. Cache identity includes API environment, user, publication, asset ID, and server content hash. Downloads check size and MIME type; native writes use a temporary file before promotion. Logout clears private audio caches. The client does not independently compute file hashes.
- Progress and word-state changes persist per account and API environment, coalesce by identity, and retry. Server writes reject older timestamps. Reader sessions pin a publication; later drafts cannot alter its translations or clips.

Modules separate DTOs, rendering/playback rules, audio cache, queued state, playback lifecycle, and the three screens (Lessons, Reader, Words). Authenticated learner endpoints live under `/api/learner`; admin audio routes remain restricted to admins.

## Verification

```sh
npm test
npx tsc --noEmit
npm run lint
npx expo export --platform web --output-dir /tmp/languages-reader-web
```

The former legacy tests were retired with their features. New tests cover occurrence identity, exact timing/punctuation, reading modes, private cache isolation, download cancellation/deduplication, queued retries, and account isolation. Browser QA also exercises the real locally published narration and clips.

Native iOS/Android audio, interrupted downloads, background transitions, and device accessibility still require device QA. Queued writes survive disconnection, but a cold offline start does not yet restore a cached lesson manifest. Existing admin analytics still report legacy learner activity. There is no legacy vocabulary backfill or automatic progress transfer between regenerated releases.

## Builds

Existing `build:android:production`, `build:ios:production`, and EAS submit scripts are retained. Production EAS points at the deployed API; local development does not deploy this backend contract. Coordinate backend migration, reader publication, and native QA before a release.
