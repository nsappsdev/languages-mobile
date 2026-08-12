import {
  buildRunnerSentencePages,
  getPagedPlaybackSegmentId,
  getPagedReaderFontSize,
  resolveRunnerSentencePageIndex,
} from '@/src/features/tasks/services/task-runner-pages';

describe('book-style runner pages', () => {
  const segments = [
    { id: 's1', text: 'First sentence.', startMs: 0, endMs: 1200 },
    { id: 's2', text: 'Second sentence.', startMs: 1200, endMs: 2600 },
  ];

  it('creates one page per timed sentence and keeps tokens between its bounds', () => {
    expect(
      buildRunnerSentencePages({
        segments,
        tokenCount: 7,
        tokenSegmentIds: ['s1', 's1', 's1', null, 's2', 's2', 's2'],
      }),
    ).toEqual([
      {
        id: 's1',
        segmentId: 's1',
        startMs: 0,
        endMs: 1200,
        tokenIndices: [0, 1, 2],
      },
      {
        id: 's2',
        segmentId: 's2',
        startMs: 1200,
        endMs: 2600,
        tokenIndices: [4, 5, 6],
      },
    ]);
  });

  it('falls back to a single complete page when sentence timing is unavailable', () => {
    expect(
      buildRunnerSentencePages({ segments: [], tokenCount: 3, tokenSegmentIds: [null, null, null] }),
    ).toEqual([
      {
        id: 'full-item',
        segmentId: null,
        startMs: null,
        endMs: null,
        tokenIndices: [0, 1, 2],
      },
    ]);
  });

  it('follows active playback without losing a valid manual page', () => {
    const pages = buildRunnerSentencePages({
      segments,
      tokenCount: 2,
      tokenSegmentIds: ['s1', 's2'],
    });
    expect(resolveRunnerSentencePageIndex({ activeSegmentId: 's2', currentIndex: 0, pages })).toBe(1);
    expect(resolveRunnerSentencePageIndex({ activeSegmentId: null, currentIndex: 1, pages })).toBe(1);
  });

  it('uses larger book type for short sentences and scales down for long ones', () => {
    expect(getPagedReaderFontSize(4, 18)).toBe(30);
    expect(getPagedReaderFontSize(14, 18)).toBe(24);
    expect(getPagedReaderFontSize(24, 18)).toBe(19);
    expect(getPagedReaderFontSize(32, 18)).toBe(18);
  });

  it('turns to the upcoming sentence as soon as the previous sentence ends', () => {
    expect(getPagedPlaybackSegmentId({ positionMs: 1199, segments })).toBe('s1');
    expect(getPagedPlaybackSegmentId({ positionMs: 1200, segments })).toBe('s2');
    expect(getPagedPlaybackSegmentId({ positionMs: 2599, segments })).toBe('s2');
  });

  it('uses the next page during a natural pause between sentences', () => {
    const withGap = [
      { id: 's1', text: 'First.', startMs: 0, endMs: 1000 },
      { id: 's2', text: 'Second.', startMs: 1800, endMs: 2800 },
    ];
    expect(getPagedPlaybackSegmentId({ positionMs: 1000, segments: withGap })).toBe('s2');
    expect(getPagedPlaybackSegmentId({ positionMs: 1500, segments: withGap })).toBe('s2');
  });
});
