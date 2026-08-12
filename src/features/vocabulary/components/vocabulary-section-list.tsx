/**
 * Compatibility exports while vocabulary remains an internal subview of the tab route.
 * Each view now owns its presentation and can move to nested routes independently.
 */
export { LearnedVocabularyArchive as VocabularyLearnedArchive } from './learned-vocabulary-archive';
export { VocabularyDashboard as VocabularyLessonDashboard } from './vocabulary-dashboard';
export { VocabularyLessonReview } from './vocabulary-lesson-review';
