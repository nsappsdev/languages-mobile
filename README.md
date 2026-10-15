# Language mobile reader

Expo Router / React Native client for published text and audio lessons. Authentication, profile, settings, native projects, and EAS configuration are retained; the legacy task runner and spelling-based vocabulary implementation have been replaced by `src/features/reader`.

## Local development

Use Node 22 or newer and the committed npm lockfile:

```sh
npm ci
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:4000/api npm run web
```

Use `npm start` for Expo device development. The API URL must be reachable from the device. Add the actual web origin to the local backend CORS allowlist. Never put provider keys in `EXPO_PUBLIC_*` variables. Existing `.env` files and EAS production configuration are not changed by the reader refactor.

The backend needs the reader publication and text-authoring migrations. In admin, save a text, explicitly generate narration, select learning occurrences, add Armenian translations, and **Publish**. Publishing extracts missing clips and makes the complete lesson available to mobile in one action.

## Reader behavior

- Lessons list only explicitly published manifests; `/runner/[lessonId]` is the single reader.
- Sentences retain punctuation and use real narration sample boundaries. Selected occurrences open contextual meanings and clips cut from that narration.
- Listen plays the narration; Practice repeats occurrences marked for practice; Deep learning repeats sentences according to saved settings. There are no provider requests from mobile.
- Word repetition counts mean isolated practice plays before the word is heard naturally in context. The configured pause applies before the drill, between every practice play, and before narration resumes at the word. Deep learning runs that word drill once, then the configured full-sentence replays. A visible counter shows the active play/replay; pausing retains the exact track position.
- Words use text release and occurrence IDs, so equal spellings remain independent. Saved states are New, Learning, and Learned.
- One playback controller owns a player for the prepared continuous track and cancels playback on mode changes, navigation, and backgrounding.
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

## Smooth repetition playback

Practice and Deep learning keep the existing word selection, repetition counts,
sequence order, and sentence-repeat rules. Playback now prepares one continuous
PCM WAV locally from the authenticated publication assets. It plays once rather
than stopping, seeking and starting a player for every word. The source narration,
clips, immutable publications and persisted learning states remain unchanged.

Word practice stops the preceding narration at the previous occurrence's aligned
speech end, keeping the inter-word gap and early consonants with the next word.
Both the repeat and resumed narration use that same source boundary. Repeats are
rendered from the canonical narration through the published clip's end, preserving
speech before the clip's midpoint cut. This prevents a partial initial consonant
from playing before the pause and avoids truncating it on resume. Deep learning
also keeps the leading gap with a sentence's first word. Character timestamps
remain unchanged for highlighting; Library audio clips remain unchanged.

Admin **Settings → Word repetition timing** controls `wordRepetitionPauseMs`
(0–3000 ms). The 400 ms preset matches the approximate rhythm of the supplied
reference. Save settings and reopen the lesson to apply changes. Existing global
settings are preserved; only the isolated local preview was set to 400 ms.

`playback-track.ts` removes only very quiet outer margins at intentional word
pauses, using actual PCM samples and an amplitude-relative safeguard for quiet
recordings. It preserves up to 6 ms of edge padding, subtracts that padding from
the inserted silence, and applies 2 ms de-click ramps at discontinuous joins.
Natural pauses inside narration remain intact. No crossfade overlaps speech and
no speech timings are inferred from text length. The settings value specifies the
quiet gap, with perception dependent on the original recording's breath/noise.

Sample spans map the prepared track back to the original narration for progress,
highlighting and repetition counters. Pause/resume retains the exact track
position, including remaining silence. Native output uses bounded file writes;
web uses Blob parts. Tracks are released on completion, replacement and unmount.
Native files live inside the private cache cleared on logout. Preparation rejects
tracks larger than 128 MiB (about 46 minutes at mono 24 kHz) with an actionable
message rather than allocating an unbounded audio buffer.

Verification on 2026-10-15: mobile unit tests, lint and TypeScript; admin tests,
lint, production build and TypeScript; browser reference-audio playback and
pause/resume. Rendering the provided real speech excerpt through the mobile
renderer produced measured internal gaps of 200.0, 400.0 and 800.0 ms for those
settings. Native file creation, size verification, cancellation and cleanup have
unit coverage; physical-device listening still needs verification.

The disposable preview now contains **A Different Way Home**, a 448-word story
with 14 Armenian vocabulary entries and real ElevenLabs narration/alignment.
The old short test fixtures were backed up and removed at the user's request.
One live narration request was explicitly approved and completed on 2026-10-15;
the boundary correction reuses that recording without further provider requests.
