# Language Mobile App

Expo Router mobile client for the language learning app.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create env file:
   ```bash
   cp .env.example .env
   ```
3. Set backend base URL in `.env`:
   - iOS simulator: `http://localhost:4000/api`
   - Android emulator: `http://10.0.2.2:4000/api`
   - Expo Go physical device: use your computer LAN IP (for example `http://192.168.1.10:4000/api`)
   - If `.env` still has `localhost` on native, the app now auto-rewrites it to Expo host LAN IP.
4. Start app:
   ```bash
   npm run start
   ```

## Current Implementation

- Auth flow (`/(auth)/login`) integrated with backend login/profile/logout.
- Main tabs:
  - `/(tabs)/lessons`
  - `/(tabs)/vocabulary`
  - `/(tabs)/profile`
- Task runner route: `/runner/[lessonId]`
- Lesson results route: `/results/[lessonId]`

## Notes

- Session persistence is implemented (secure store on native when available, safe browser storage fallback on web).
- Progress sync events are implemented with queued batching and retry.
- Dashboard now enforces level-order lesson progression (future lessons lock until current is completed).
- Lesson runner supports cached audio playback, phrase/word timing, reading modes, and tap-to-mark-unknown vocabulary reveal.
- Vocabulary sync is user-scoped: local status changes are cached immediately, then flushed to the backend.

## Production Builds (EAS)

- Android production build:
  ```bash
  npm run build:android:production
  ```
- Android Play Store bundle alias:
  ```bash
  npm run build:android:store
  ```
- Android Play Internal Testing submit:
  ```bash
  npm run submit:android:internal
  ```
- iOS production archive (`.ipa`):
  ```bash
  npm run build:ios:production
  ```
- Build Android + iOS in one command:
  ```bash
  npm run build:all:production
  ```

For the full Android internal testing rollout checklist, see `../docs/deployment.md`.

Current EAS production builds use `EXPO_PUBLIC_API_BASE_URL=https://lezoo.app/api` from `eas.json`.

## Tests

- Run tests once:
  ```bash
  npm run test
  ```
- Watch mode:
  ```bash
  npm run test:watch
  ```
- Coverage run:
  ```bash
  npm run test:coverage
  ```
