# Language Mobile App (Phase 1)

Expo Router mobile client for the task-based language learning MVP.

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

## Current Implementation Slice

- Auth flow (`/(auth)/login`) integrated with backend login/profile/logout.
- Main tabs:
  - `/(tabs)/lessons`
  - `/(tabs)/vocabulary`
  - `/(tabs)/profile`
- Lesson detail route: `/lesson/[lessonId]`
- Task runner route: `/runner/[lessonId]`
- Lesson results route: `/results/[lessonId]`

## Notes

- Session persistence is implemented (secure store on native when available, safe browser storage fallback on web).
- Progress sync events are implemented with queued batching and retry.
- Dashboard now enforces level-order lesson progression (future lessons lock until current is completed).
- Select any text in task prompts and tap Add to Vocabulary to save it.
- Vocabulary sync is user-scoped: add responses merge locally immediately, then screen refreshes from backend source of truth.
- Full `LISTENING_TEXT` audio playback integration is still planned in the next implementation slice.

## Production Builds (EAS)

- Android production APK:
  ```bash
  npm run build:android:production
  ```
- Android Play Store bundle (`.aab`):
  ```bash
  npm run build:android:store
  ```
- iOS production archive (`.ipa`):
  ```bash
  npm run build:ios:production
  ```
- Build Android + iOS in one command:
  ```bash
  npm run build:all:production
  ```

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
