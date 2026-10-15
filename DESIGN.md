# Mobile visual direction

This is a restrained refinement of the existing Lezoo reading app. Preserve the light canvas, teal accent, system typography, route names, and learning flows. Use React Native components and the installed Ionicons family; no new design or animation dependency is needed.

The lesson list, vocabulary library, account, and authentication screens help people complete familiar tasks. The reader prioritizes uninterrupted reading. Use consistent type roles, clear labels, and quiet surfaces rather than decorative effects. Taste settings for this pass: design variance 3, motion intensity 2, visual density 4.

- Colors come from `src/shared/theme/colors.ts`. Teal identifies primary actions and selected states. Red, amber, and green retain their status meanings.
- System fonts support native font scaling and Armenian text. Narration text and translation typography continue to use the admin settings.
- Use the 4-point spacing scale, 20-point phone gutters, 12-point control corners, and 16-point content corners. Limit the reading measure to 680 points and other content to 760.
- Shared actions use `PrimaryButton`. Keep controls at least 48 points tall. Inline reader words retain their text layout and tap behavior.
- The bottom navigation keeps Lessons, Library, and Profile in the existing order. Constrain its inner width on larger screens and retain safe-area padding.
- Keep the reader passage free of a nested card. Its playback dock remains visible, with one primary play/pause action and secondary restart/finish controls.
- Motion communicates existing playback state. Do not add entrance animations, gradients, glass, or decorative imagery.

Behavioral boundary: do not change narration generation, sample boundaries, repetition counts, seeking, word status, translation reveal, progress persistence, authentication, or update policy as part of a visual refinement. Keep the production dependency versions and EAS configuration intact.
