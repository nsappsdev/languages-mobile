# Mobile Redesign and Refactor Approval Plan

Date: 2026-08-11
Scope: `mobile/` only
Status: approved; first implementation slice is in progress on `feat/mobile-calm-editorial-redesign`

## 1. Recommended direction

Adopt a **Modified Calm Editorial** direction:

- Use Calm's warm paper canvas, quiet teal identity, thin borders, generous spacing, and editorial hierarchy.
- Borrow only Bold's stronger active states, progress visibility, and high-contrast primary actions.
- Reject Bold's brutalist borders, hard shadows, condensed all-caps labels, streak coaching, and gamification language.
- Do not copy either Stitch runner. Both generated runners change core product behavior.
- Keep the implementation native: Expo Router, React Native primitives, and `StyleSheet`. Stitch HTML and Tailwind are design evidence only.

This direction fits the learning product better than a loud coaching interface and is materially closer to the existing teal visual identity.

## 2. Evidence reviewed

### Repository

The audit covered:

- every route under `app/`;
- shared UI, theme, session, update, and navigation code under `src/shared/`;
- auth, lessons, runner, vocabulary, results, and profile screens;
- runner playback/layout hooks and services that constrain visual changes;
- existing tests and mobile status/refactor documentation;
- current web rendering at a 390 x 844 viewport for login, loaded dashboard, vocabulary, profile, and runner.

### Google Stitch MCP

The Google Stitch MCP connection is live. The existing project is:

- Project: `LinguArmenia Mobile Redesign`
- Project ID: `10524307659823708719`
- Device: mobile
- Current project design system: Calm Editorial

Six visible Stitch screens were read:

1. A - Dashboard (Calm)
2. A - Lesson Runner (Calm)
3. A - Vocabulary (Calm)
4. B - Dashboard (Bold)
5. B - Lesson Runner (Bold)
6. B - Vocabulary (Bold)

Three design-system assets exist:

- `565706bf0bb349ba82eb307c0b0d88ed`: Calm Editorial
- `8395f4feaa6542f1b88a1acdbc3d83c2`: Bold Kinetic Coach
- `344059fcb500470fad142b04816fe0fd`: older Lumina Lexicon direction, apparently unused

No Stitch project, design system, or screen was changed during this audit.

## 3. Product map and design-state coverage

| Area | Route or state | Required design states |
|---|---|---|
| Session gate | `/` | restoring session, signed out redirect, signed in redirect |
| Login | `/(auth)/login` | idle, invalid input, API error, disabled submit, submitting |
| Signup | `/(auth)/signup` | idle, validation error, API error, disabled submit, submitting |
| Lessons | `/(tabs)/lessons` | loading, retryable error, empty, refreshing, populated, unverified lock, current/completed/open cards |
| Runner | `/runner/[lessonId]` | preparing, retry error, cached/streaming/no audio, first/middle/last item, mode disabled/playing/paused, sync warning |
| Runner words | internal runner state | sentence seek while playing; vocabulary toggle while paused; pending/saved/unknown/missing translation; full Armenian label and pulse |
| Results | `/results/[lessonId]` | completion summary, retry lesson, return to lessons |
| Vocabulary dashboard | `/(tabs)/vocabulary` internal state | loading, error/retry, empty, search/no match, lesson counts, learned count, offline snapshot metadata |
| Vocabulary review | internal state | masked/revealed Armenian, word audio, context audio, Again, Know, correct streak, complete |
| Learned archive | internal state | search, no match, empty, restore to review |
| Profile | `/(tabs)/profile` | display, refresh, edit, validation error, API error, saving, verification banner, sign out |
| Verification | shared block | cooldown, attempts exhausted, sent feedback, request error, refresh status |
| Update notice | root modal | optional/dismissible and required/non-dismissible |
| Navigation | shared | active destination, safe area, keyboard, signed-out hidden, focused runner/results behavior |

Stitch currently covers only part of Lessons, Runner, and Vocabulary. It does not yet specify the remaining screens or most real loading, error, offline, and interaction states.

## 4. What the live comparison revealed

### Keep from Calm

- Warm ivory or pale mint canvas rather than cold gray.
- White cards with warm thin borders.
- Teal primary actions and progress.
- A restrained serif/sans hierarchy.
- Generous vertical rhythm and calmer reading surfaces.
- Vocabulary masked/revealed states and explicit Again/Know actions.

### Borrow from Bold

- More visible current lesson treatment.
- Stronger selected/playing state contrast.
- Clear segmented or strongly labeled progress where it communicates real progress.
- Primary actions that are visually unambiguous.

### Reject or rewrite

- Calm runner scrubber, replay, and forward controls: these are not the current runner behavior.
- Bold runner microphone and voice-recognition actions: they do not exist in the product.
- Bold “Kinetic Momentum” figure panel: decorative and unrelated to the real learning flow.
- Passive Introduction/Teaching/Deep Learning tabs: these are independent play/pause controls in the app.
- Locked lesson cards and fake duration metadata: the current catalog allows open/current/completed states and exposes item counts.
- Percentile motivation, streak coaching, floating plus, avatars, and menus: unsupported inventions.
- One-card-only vocabulary review: the app reviews a scrollable lesson word set and includes word/context audio.

### Naming issue

Stitch uses `Lezoo`, `Linguist`, and `LinguistCore`; the current UI says `Language App`; Expo metadata says `language`. Product naming must be selected once before implementation and used in app metadata, headers, auth, and Stitch references.

## 5. Current design inventory

### 5.1 Effective repository theme

All normal imports use `@/src/shared/theme`, which resolves to `src/shared/theme.ts`.

#### Brand colors

| Token | Value |
|---|---|
| `brand.50` | `#ECFEFF` |
| `brand.100` | `#CFFAFE` |
| `brand.200` | `#A5F3FC` |
| `brand.300` | `#67E8F9` |
| `brand.400` | `#22D3EE` |
| `brand.500` | `#06B6D4` |
| `brand.600` | `#0891B2` |
| `brand.700` | `#0E7490` |
| `brand.800` | `#155E75` |
| `brand.900` | `#164E63` |

#### Neutral colors

| Token | Value |
|---|---|
| `neutral.0` | `#FFFFFF` |
| `neutral.50` | `#F9FAFB` |
| `neutral.100` | `#F3F4F6` |
| `neutral.200` | `#E5E7EB` |
| `neutral.300` | `#D1D5DB` |
| `neutral.400` | `#9CA3AF` |
| `neutral.500` | `#6B7280` |
| `neutral.600` | `#4B5563` |
| `neutral.700` | `#374151` |
| `neutral.800` | `#1F2937` |
| `neutral.900` | `#111827` |

#### Semantic aliases

| Group | Values |
|---|---|
| Text | primary `#111827`; secondary `#6B7280`; muted `#9CA3AF`; brand `#0E7490`; warning `#B45309`; error `#DC2626`; inverse `#FFFFFF` |
| Surface | background/card/input `#FFFFFF`; subtle `#F9FAFB`; page `#F8FAFC`; active `#ECFEFF`; overlay `rgba(255,255,255,0.92)` |
| Border | default `#E5E7EB`; subtle `#F3F4F6`; active `#0E7490`; warning `#FDBA74` |

#### Typography

| Token | Size |
|---|---:|
| `xs` | 11 |
| `sm` | 12 |
| `base` | 14 |
| `md` | 15 |
| `lg` | 16 |
| `xl` | 18 |
| `2xl` | 22 |
| `3xl` | 28 |
| `4xl` | 30 |
| `5xl` | 32 |

Weights are 400, 500, 600, and 700. The active theme has no reusable line-height, letter-spacing, or type-role presets.

#### Radii

`0, 4, 8, 12, 16, 20, 24, 9999`

### 5.2 Conflicting unused theme

`src/shared/theme/` defines another token system with:

- different teal values (`#0F766E` rather than the active `#0E7490`);
- slate neutrals instead of gray neutrals;
- different font sizes (`base 13`, `md 14`, `2xl 20`, `3xl 24`);
- different radii (`6, 8, 12, 14, 16, 18, 24, 999`);
- a 4-point spacing scale that no screen imports.

This file/directory name collision is the first refactor target. It is too easy to edit the unused system while believing the app changed.

### 5.3 Hard-coded colors outside the theme

There are 28 hard-coded color occurrences representing 25 unique colors outside theme definitions/tests.

| Area | Values |
|---|---|
| Results | `#0F172A`, `#475569`, `#FFFFFF`, `#DBEAFE`, `#64748B`, `#0F766E` |
| Runner chrome | `#A5F3FC`, `#155E75`, `#CFFAFE`, `#0891B2` |
| Runner word states | `#0F766E`, `#DC2626`, `#EFF6FF`, `#1D4ED8`, `#C2410C`, `#B45309` |
| Lesson badges | `#DCFCE7`, `#166534`, `#CCFBF1`, `#FEF3C7`, `#92400E` |
| Vocabulary decisions | `#FFF7ED`, `#FED7AA`, `#C2410C`, `rgba(8,145,178,0.12)` |
| Verification | `#FFFBEB` |
| Update modal | `rgba(15,23,42,0.38)` |
| Floating footer | `rgba(0,0,0,0.08)` |
| App chrome/config | Android icon background `#E6F4FE`; light/dark splash colors |

### 5.4 Hard-coded sizing patterns

- Extra font sizes: 10, 12, 13, 15, 17, 19, 20, 24, 26, 30.
- Extra line heights: 13, 20, 22.
- Gaps: 2, 3, 4, 6, 8, 10, 12, 14, 16.
- Padding: 8, 10, 12, 14, 16, 18, 20, 24.
- Horizontal padding: 8, 10, 12, 14, 16, 20, 24.
- Bottom margins: 3, 4, 5, 6, 8, 10, 12, 14, 18, 24, 28, 32.
- Progress heights differ across screens: 7, 8, and 10.
- Control heights differ across screens: 36, 42, 44, 46, and 48.
- Pressed opacity differs across components: approximately 0.72, 0.85, 0.86, and 0.90.

The 36- and 42-point controls do not consistently meet a 44-point touch target and usually lack `hitSlop`.

### 5.5 Runner design constants that are functional contracts

These must not be normalized away as ordinary decorative tokens:

- Default English lesson word size/line height: 18/24.
- Backend settings may override main text font family and size.
- Armenian translation fitting defaults to a maximum of 15 and minimum of 8.
- Armenian letter spacing fits between -0.2 and 0.8.
- Translation width, phrase-focus anchoring, and pulse timing are calculated behavior.
- Long Armenian labels must stay fully visible, centered over the correct word/focus word, and able to reserve width.
- The missing-translation `∅` state has its own animation/scale behavior.

These values belong in a dedicated `runnerTypography` and `runnerMotion` contract, not generic body typography.

## 6. Stitch token inventory

### 6.1 Calm Editorial

#### Primary guidance colors

| Role | Value |
|---|---|
| Warm ivory background | `#F7F4ED` |
| Forest teal | `#0F766E` |
| Soft mint | `#DDF2EA` |
| Terracotta | `#E87956` |
| Deep ink | `#17211F` |
| Warm border | `#E5E1D8` |

#### Generated Material palette

| Group | Values |
|---|---|
| Primary | primary `#005C55`; container `#0F766E`; fixed `#9CF2E8`; fixed dim/inverse `#80D5CB`; on-primary `#FFFFFF`; on-container `#A3FAEF`; darkest `#00201D`; variant `#00504A` |
| Secondary | secondary `#4F625C`; container/fixed `#D2E7DF`; fixed dim `#B6CBC3`; on-secondary `#FFFFFF`; on-container `#556862`; darkest `#0D1F1A`; variant `#384B45` |
| Tertiary | tertiary `#8D3518`; container `#AD4C2D`; fixed `#FFDBD0`; fixed dim `#FFB59E`; on-tertiary `#FFFFFF`; on-container `#FFE5DE`; darkest `#3A0B00`; variant `#7F2B0E` |
| Surfaces | `#F1FCF8`, `#EBF6F2`, `#E5F0ED`, `#DFEBE7`, `#DAE5E1`, `#D1DCD9`, `#FFFFFF` |
| Text/inverse | `#131D1C`, `#3E4947`, `#283230`, `#E8F3EF` |
| Outline | `#6E7977`, `#BDC9C6` |
| Error | `#BA1A1A`, `#FFDAD6`, `#93000A`, `#FFFFFF` |

The guidance and generated palette conflict on background and primary. A canonical subset must be selected before implementation.

#### Calm typography

| Role | Family | Size / line | Weight |
|---|---|---|---:|
| Display desktop | Source Serif 4 | 48 / 56 | 700 |
| Display mobile | Source Serif 4 | 32 / 40 | 700 |
| Headline medium | Source Serif 4 | 32 / 40 | 600 |
| Headline small | Source Serif 4 | 24 / 32 | 600 |
| Title | Libre Franklin | 20 / 28 | 600 |
| Body large | Libre Franklin | 18 / 30 | 400 |
| Body | Libre Franklin | 16 / 24 | 400 |
| Label | Libre Franklin | 14 / 20 | 500 |
| Caption label | Libre Franklin | 12 / 16 | 600 |

Spacing is 4, 12, 24, 40, and 64 with a nominal 24-pixel gutter. Main shapes are approximately 12-pixel controls, 20-pixel cards, and 32-pixel large containers. Depth uses borders and one subtle shadow: `0 4 12 rgba(23,33,31,0.05)`.

### 6.2 Bold Kinetic Coach

#### Generated colors

| Group | Values |
|---|---|
| Primary | primary `#4141C8`; container `#5B5CE2`; fixed `#E1DFFF`; fixed dim/inverse `#C1C1FF`; darkest `#08006B`; variant `#322FBA` |
| Secondary | secondary `#006B5F`; container/fixed `#86F6E3`; fixed dim `#68D9C7`; darkest `#00201C`; variant `#005047`; on-container `#007165` |
| Tertiary | tertiary `#9C2C29`; container `#BD443F`; fixed `#FFDAD6`; fixed dim `#FFB3AC`; darkest `#410003`; variant `#881D1D`; on-container `#FFECEA` |
| Surfaces | `#FBF8FF`, `#F4F2FF`, `#EDECFF`, `#E6E6FF`, `#DFE0FF`, `#D5D7FF`, `#FFFFFF` |
| Text/inverse | `#14183A`, `#464554`, `#2A2E50`, `#F1EFFF` |
| Outline | `#777586`, `#C7C4D7` |
| Error | `#BA1A1A`, `#FFDAD6`, `#93000A`, `#FFFFFF` |

The concept guidance also uses indigo `#5B5CE2`, mint `#65D6C4`, coral `#FF756C`, navy `#171B3D`, and lavender `#F5F3FF`.

#### Bold typography

| Role | Family | Size / line | Weight |
|---|---|---|---:|
| Display desktop | Anybody | 48 / 52 | 800 |
| Display mobile | Anybody | 36 / 40 | 800 |
| Headline | Anybody | 24 / 28 | 700 |
| Body large | Hanken Grotesk | 18 / 28 | 400 |
| Body | Hanken Grotesk | 16 / 24 | 400 |
| Label bold | Archivo Narrow | 14 / 16 | 700 |
| Label small | Archivo Narrow | 12 / 14 | 600 |

Spacing is 4, 8, 16, 24, and 40. The direction relies on 2-pixel borders and hard 4-pixel shadows.

## 7. Proposed canonical design contract

This is the recommended approval baseline, not yet code.

### 7.1 Color roles

| Token | Proposed value | Use |
|---|---|---|
| `canvas` | `#F7F4ED` | primary page background |
| `surface` | `#FFFFFF` | cards, inputs, sheets |
| `surfaceSubtle` | `#F1FCF8` | quiet sections and selected background |
| `surfaceMint` | `#DDF2EA` | progress/support callouts |
| `primary` | `#0F766E` | primary action, active navigation, progress |
| `primaryStrong` | `#005C55` | pressed/high-emphasis action |
| `primarySoft` | `#DDF2EA` | soft selected state |
| `ink` | `#17211F` | primary text |
| `inkMuted` | `#4F625C` | secondary text |
| `border` | `#E5E1D8` | standard warm outline |
| `borderStrong` | `#BDC9C6` | stronger separator/control outline |
| `accent` | `#E87956` | limited attention/progress accent |
| `success` | `#166534` | completed/known |
| `successSurface` | `#DCFCE7` | completed/known background |
| `warning` | `#B45309` | pending/open/attention |
| `warningSurface` | `#FFF7ED` | warning background |
| `danger` | `#BA1A1A` | error/destructive |
| `dangerSurface` | `#FFDAD6` | error background |
| `scrim` | `rgba(23,33,31,0.42)` | modal backdrop |

Before freezing these values, run automated contrast checks for normal text, small labels, disabled states, and controls.

### 7.2 Typography roles

Candidate families:

- English/editorial headings: Source Serif 4.
- English UI/body: Libre Franklin.
- Armenian: keep the platform font initially or bundle a verified Armenian family such as Noto Sans Armenian after a glyph/metric spike.

Do not ship Source Serif/Libre Franklin while Armenian silently falls back without visual QA. Test Armenian words, long translations, punctuation, mixed English/Armenian, Android, iOS, and web.

| Role | Proposed size / line | Weight |
|---|---|---:|
| Display mobile | 32 / 40 | 700 |
| Screen title | 28 / 36 | 700 |
| Section title | 24 / 32 | 600 |
| Card title | 20 / 28 | 600 |
| Body large | 18 / 30 | 400 |
| Body | 16 / 24 | 400 |
| Label | 14 / 20 | 500 or 600 |
| Caption | 12 / 16 | 600 |
| Micro status | 11 / 14 | 600, only when contrast permits |

Runner English and Armenian sizing remains its own configurable contract.

### 7.3 Spacing, shape, elevation, and interaction

- Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 64.
- Phone gutter: 16 or 20; tablet gutter: 24 or 32.
- Content widths: forms 420 maximum; readable content 680 maximum; general tablet content 760 maximum.
- Radii: 8 control-small, 12 control, 20 card, 32 feature surface, full pill.
- Minimum effective touch target: 44 x 44; standard primary control height: 48.
- Progress height: 8 standard, 4 compact.
- Icons: 16, 18, 20, 24, 44 hero/status.
- Pressed opacity: 0.86 when a color/transform pressed state is not used.
- Disabled opacity: 0.45 plus semantic disabled text/background.
- Level 0: canvas, no shadow.
- Level 1: white surface with 1-pixel warm border.
- Level 2: `0 4 12 rgba(23,33,31,0.05)` for interactive/floating surfaces only.
- Respect Reduce Motion for decorative transitions. Preserve functional runner feedback with a reduced alternative.

## 8. Problematic areas and refactor plan

### P0 - Resolve before visual implementation

#### One design-system source

Problem: `src/shared/theme.ts` and `src/shared/theme/` conflict.

Plan:

1. Make `src/shared/theme/` the only source.
2. Move/freeze the approved semantic contract there.
3. Remove the name collision.
4. Add missing typography roles, spacing, sizes, elevation, opacity, content widths, and motion.
5. Replace literal values with semantic tokens while initially preserving current behavior.

#### Protect runner behavior

Problem: the 708-line `task-runner-screen.tsx` coordinates playback, scroll measurement, animations, progress sync, vocabulary, completion, and rendering. `TaskWordFlow` has more than 20 props and combines measurement, fitting, animation, state interpretation, and presses.

Plan:

- Capture characterization tests/screens for every runner state before presentation changes.
- Extract a presentational `RunnerShell`, header, item metadata, progress, mode controls, navigation actions, and status notice.
- Group word-flow inputs into stable view-model/controller objects instead of continuing prop growth.
- Keep timing, seek, vocabulary, phrase matching, fit, pulse, cache, and sync services intact.
- Redesign runner chrome first; touch token layout only behind existing and new regression tests.

#### Navigation ownership

Problem: the runner currently shows the native Stack header, an in-screen back control, and the global footer at the same time.

Plan:

- Render bottom navigation only inside the tab group.
- Prefer an Expo Router `Tabs` layout for Dashboard, Vocabulary, and Profile, or at minimum scope the custom footer to tab routes.
- Give Runner and Results one focused header/navigation model and no global footer.
- Define hardware back, deep link, and return-to-dashboard behavior explicitly.

### P1 - Shared primitives and high-value screens

Create native primitives before restyling screens independently:

```text
src/shared/theme/
  colors.ts
  typography.ts
  spacing.ts
  radii.ts
  sizes.ts
  elevation.ts
  motion.ts
  index.ts

src/shared/ui/
  app-screen.tsx
  app-header.tsx
  button.tsx
  icon-button.tsx
  text-field.tsx
  card.tsx
  badge.tsx
  progress-bar.tsx
  notice.tsx
  feedback-state.tsx
  bottom-navigation.tsx

src/features/tasks/theme/
  runner-typography.ts
  runner-motion.ts
```

Minimum component states:

- buttons: primary, secondary, quiet, danger, disabled, loading;
- text fields: idle, focused, filled, invalid, disabled;
- cards: static, pressable, selected, completed, warning;
- feedback: loading, empty, error, offline/pending;
- progress: determinate, segmented, compact;
- navigation: selected, unselected, safe-area, keyboard hidden.

### P1 - Feature boundaries

#### Auth

Problem: login and signup repeat the same shell, field, error, submit, and link patterns.

Plan: extract `AuthShell`, `FormField`, inline error, and auth link action. Make auth scroll/keyboard/large-text safe.

#### Vocabulary

Problem: `vocabulary-section-list.tsx` is 413 lines and holds dashboard, review, archive, rows, audio actions, back buttons, and empty states. Its shared stylesheet is 406 lines. The 288-line data hook mixes server loading, cache fallback, optimistic review, archive aggregation, restore, and sync messages.

Plan:

- Split `VocabularyDashboard`, `VocabularyLessonReview`, `VocabularyReviewRow`, and `LearnedVocabularyArchive`.
- Give each view its own styles or primitives.
- Add a small typed view-state reducer.
- Prefer nested routes for lesson review and learned archive so hardware back, deep links, and state restoration work; if route changes are rejected, implement an explicit internal navigation state machine.
- Preserve masked/revealed Armenian, word/context audio, Again/Know, two-pass mastery, restore, cache, and offline sync.

#### Profile

Problem: one file mixes refresh/network orchestration, editor state, validation, save, verification, logout, and extensive local styling.

Plan: extract `useProfileEditor`, identity card, editable name field, verification status, and sign-out action.

#### Results

Problem: the whole screen bypasses the theme and forces three minimum-width stat cards into one row.

Plan: migrate to shared header/card/button/progress primitives and allow responsive wrap/stack for narrow screens and Dynamic Type.

### P2 - Accessibility and responsiveness

- Add accessibility roles/labels/states to primary buttons, auth links, footer items, lesson cards, retry controls, runner back, and word actions.
- Expose selected/playing/busy/disabled state to assistive technology.
- Give word actions an accessibility hint that changes between seek and vocabulary toggle behavior.
- Add effective 44-point targets or `hitSlop` to small icon/word controls where appropriate.
- Replace low-contrast muted 11-12 pixel text where it fails WCAG contrast.
- Add Reduce Motion handling.
- Add max-width/responsive shells using `useWindowDimensions`.
- Make auth, profile, results, and long-form states scroll/keyboard/large-text safe.
- Decide explicitly between full dark mode support and light-only. Recommendation for this redesign: lock to a deliberate light theme first; add dark mode as a separate complete design phase.

### P3 - Cleanup

- Remove unused starter image assets after confirming no app/config references.
- Align product name across Expo metadata, auth, headers, and Stitch.
- Align `docs/refactor-plan.md` with the new approved plan after implementation starts.
- Define visual regression fixtures for representative English and Armenian content.

## 9. Screen-by-screen redesign plan

### Phase 0 - Baseline and contracts

- Freeze current phone screenshots and representative state data.
- Record navigation visibility rules.
- Add/confirm runner characterization coverage.
- Fix the existing TypeScript test typing baseline before relying on `tsc --noEmit` as a gate.
- Perform font glyph/metric and color contrast spikes.

Exit: current behavior is reproducible and acceptance gates are measurable.

### Phase 1 - Foundation

- Consolidate theme.
- Load approved fonts, or keep system fonts until the font spike passes.
- Build shared primitives and responsive screen shells.
- Move bottom navigation into tab ownership.

Exit: a component gallery/state fixture demonstrates every primitive without changing feature behavior.

### Phase 2 - Auth, profile, update, and results

- Apply Calm shell and typography.
- Unify forms and feedback.
- Normalize modals and focused flow navigation.
- Make small-phone, keyboard, large-text, and tablet layouts safe.

Exit: all non-core screens use the new tokens/primitives and preserve API/session behavior.

### Phase 3 - Lessons dashboard

- Use real lesson and progress data in a Calm composition.
- Keep total/completed summary, overall progress, current lesson, and actual status badges.
- Use strong current/primary CTA treatment borrowed from Bold.
- Preserve loading/error/empty/refresh/unverified states.

Exit: dashboard visual approval and state coverage pass.

### Phase 4 - Vocabulary

- Refactor dashboard/review/archive boundaries.
- Apply the editorial card/list system.
- Preserve explicit reveal, audio, Again/Know, streak, learned archive, restore, and offline states.
- Avoid Bold's gamified single-card interpretation.

Exit: full vocabulary workflow passes native, web, offline, search, and accessibility checks.

### Phase 5 - Runner shell

- Replace duplicate navigation layers with one focused header.
- Restyle metadata, progress, reading modes, notices, and previous/next/finish actions.
- Keep the real long inline text flow; do not substitute a concept card.
- Keep all three modes as independent play/pause controls.
- Keep cache/stream/no-audio status.

Exit: shell matches the approved direction without a TaskWordFlow behavior regression.

### Phase 6 - Runner word-flow presentation

- Only after Phase 5 passes, refine active sentence, active word/phrase, pending/unknown/saved/missing states.
- Preserve English wrapping and phrase boundaries.
- Preserve full centered Armenian translations and pulse behavior.
- Validate very long Armenian labels and admin-selected font settings.

Exit: timing, scroll, seek, vocabulary, phrase, and translation regression suites pass on narrow native devices.

### Phase 7 - Polish and release gate

- Visual regression suite at small phone, standard phone, large phone, and tablet.
- Dynamic Type, VoiceOver/TalkBack, reduced motion, keyboard, safe-area, and contrast checks.
- Offline/cache/pending sync and required-update modal checks.
- Performance check for long runner content and vocabulary lists.
- Remove dead theme/assets and update documentation.

## 10. Behavior that must not change

### Runner

- Tapping a word while paused toggles a known dictionary word as unknown and reveals Armenian immediately.
- Tapping during playback seeks to the correct segment/sentence and gives immediate feedback.
- Introduction, Teaching, and Deep Learning retain their actual independent playback behavior.
- Teaching/Deep Learning word and phrase repetition, pause timing, focus word, and pulse schedule stay intact.
- Long Armenian translations remain fully visible and centered over their anchor.
- Missing translations retain the temporary `∅` feedback and do not create an invalid vocabulary write.
- Audio cache/stream selection, next-item prefetch, buffering handling, and background/focus refresh stay intact.
- Progress remains queued/offline-safe and lesson completion still routes to Results.

### Vocabulary

- Lesson-first review stays explicit.
- Armenian remains masked until reveal.
- Word and context audio remain distinct actions.
- Again resets progress; two Know decisions complete mastery.
- Learned archive search and restore remain available.
- Cached/offline data and pending sync feedback remain visible.

### Lessons and account

- Real current/completed/open states remain authoritative.
- Unverified users retain the verification/resend flow.
- Optional/required update behavior remains unchanged.
- Profile edit, refresh, verification, and logout behavior remains unchanged.

## 11. Verification matrix

| Gate | Required checks |
|---|---|
| Static | TypeScript, lint, formatting/diff check |
| Unit | existing runner, vocabulary, auth, storage, progress, and version suites |
| Characterization | runner seek/toggle/mode/pulse/layout; vocabulary reveal/audio/Again/Know/archive |
| Visual | login, signup, lessons, runner, results, vocabulary dashboard/review/archive, profile, update modal |
| Viewports | 320-360 narrow phone, 390 standard phone, large phone, tablet |
| Text | large Dynamic Type, long English, long Armenian, mixed scripts, missing translation |
| Accessibility | roles, labels, states, focus order, contrast, touch targets, reduced motion, screen reader |
| Network | loading, slow, error, retry, cached, streaming, offline, pending sync |
| Navigation | deep link, hardware back, active tab, runner/results focus, keyboard and safe area |
| Performance | long lesson render/scroll, playback UI updates, large vocabulary list |

## 12. Approval decisions

Recommended defaults are marked below.

1. **Visual direction:** Modified Calm Editorial with selective Bold active states. **Recommended: approve.**
2. **Fonts:** Source Serif 4 + Libre Franklin for English only after bundled-font QA; verified Armenian font/fallback. **Recommended: approve the spike, not final font shipping yet.**
3. **Navigation:** footer only on Dashboard/Vocabulary/Profile; focused Runner and Results. **Recommended: approve.**
4. **Vocabulary substates:** convert review/archive to nested routes. **Recommended: approve unless URL stability is a concern.**
5. **Theme mode:** ship a deliberate light redesign first, dark mode later as a full design. **Recommended: approve.**
6. **Product name:** select one name before implementation. **Required user decision.**

The visual direction, navigation, and light-theme defaults were approved on 2026-08-11. Product naming remains intentionally unchanged until a final name is selected.

## 13. Implementation checkpoint - 2026-08-11

Completed locally on `feat/mobile-calm-editorial-redesign`:

- consolidated the duplicate theme modules into one canonical token system;
- added reusable cards, progress, feedback, fields, buttons, responsive containers, and layout tokens;
- limited the persistent footer to Dashboard, Vocabulary, and Profile;
- rebuilt auth, lessons, vocabulary, profile, results, update, and verification presentation in the Modified Calm Editorial direction;
- refactored the vocabulary and runner presentation into smaller components while preserving playback, reveal, audio, mastery, archive, cache, and sync behavior;
- introduced explicit runner typography and motion contracts without shipping unverified bundled fonts;
- changed app chrome and splash surfaces to the approved deliberate light theme.
- added an experimental `Lessons 2` tab and alternate book-style runner that swaps one timed sentence at a time while reusing the existing playback and fitted word-translation behavior.

Verification completed:

- TypeScript: passed;
- Expo lint: passed;
- Jest: 22 suites and 102 tests passed;
- Expo web static export: passed for all 15 routes;
- Expo configuration resolution: passed;
- diff whitespace check: passed.

Still open before release:

- visual QA at all matrix viewports; the current browser runtime exposed no session during this checkpoint;
- real-device Dynamic Type, screen-reader, reduced-motion, audio, offline, and playback validation;
- bundled font glyph and metric spike before using Source Serif 4, Libre Franklin, or an Armenian-specific family;
- final product-name decision;
- optional vocabulary review/archive nested routes, which were not included in this behavior-preserving slice.
