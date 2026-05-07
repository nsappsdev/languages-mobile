import { getTokenSegmentIds, groupTokenIndicesBySegment } from '../task-runner-segments';

describe('groupTokenIndicesBySegment', () => {
  it('groups consecutive tokens by their segment id and keeps loose tokens separate', () => {
    const tokenSegmentIds = ['s1', 's1', null, 's1', 's2', 's2', null, 's3'];
    const segments = [
      { id: 's1', startMs: 0, endMs: 1000 },
      { id: 's2', startMs: 1000, endMs: 2000 },
      { id: 's3', startMs: 2000, endMs: 3000 },
    ];

    const groups = groupTokenIndicesBySegment(tokenSegmentIds, segments);

    expect(groups).toEqual([
      { segmentId: 's1', startMs: 0, tokenIndices: [0, 1] },
      { segmentId: null, startMs: null, tokenIndices: [2] },
      { segmentId: 's1', startMs: 0, tokenIndices: [3] },
      { segmentId: 's2', startMs: 1000, tokenIndices: [4, 5] },
      { segmentId: null, startMs: null, tokenIndices: [6] },
      { segmentId: 's3', startMs: 2000, tokenIndices: [7] },
    ]);
  });

  it('places leading non-segment tokens in a null-segment group', () => {
    const tokenSegmentIds = [null, null, 's1', 's1'];
    const segments = [{ id: 's1', startMs: 500, endMs: 1500 }];

    const groups = groupTokenIndicesBySegment(tokenSegmentIds, segments);

    expect(groups).toEqual([
      { segmentId: null, startMs: null, tokenIndices: [0, 1] },
      { segmentId: 's1', startMs: 500, tokenIndices: [2, 3] },
    ]);
  });

  it('returns one null-segment group when there are no segments', () => {
    const tokenSegmentIds = [null, null, null];
    const groups = groupTokenIndicesBySegment(tokenSegmentIds, []);

    expect(groups).toEqual([{ segmentId: null, startMs: null, tokenIndices: [0, 1, 2] }]);
  });

  it('returns an empty array for zero tokens', () => {
    expect(groupTokenIndicesBySegment([], [])).toEqual([]);
  });
});

describe('getTokenSegmentIds', () => {
  it('maps tokens only into exact admin segment text ranges', () => {
    const text = 'Intro. First sentence. Second sentence.';
    const tokens = [
      { start: 0, end: 5 },
      { start: 5, end: 6 },
      { start: 7, end: 12 },
      { start: 13, end: 21 },
      { start: 21, end: 22 },
      { start: 23, end: 29 },
      { start: 30, end: 38 },
      { start: 38, end: 39 },
    ];
    const segments = [
      { id: 's1', text: 'First sentence.', startMs: 0, endMs: 1000 },
      { id: 's2', text: 'Second sentence.', startMs: 1000, endMs: 2000 },
    ];

    expect(getTokenSegmentIds(tokens, text, segments)).toEqual([
      null,
      null,
      's1',
      's1',
      's1',
      's2',
      's2',
      's2',
    ]);
  });

  it('finds repeated segment text in reading order', () => {
    const text = 'Read. Read.';
    const tokens = [
      { start: 0, end: 4 },
      { start: 4, end: 5 },
      { start: 6, end: 10 },
      { start: 10, end: 11 },
    ];
    const segments = [
      { id: 'first', text: 'Read.', startMs: 0, endMs: 1000 },
      { id: 'second', text: 'Read.', startMs: 1000, endMs: 2000 },
    ];

    expect(getTokenSegmentIds(tokens, text, segments)).toEqual([
      'first',
      'first',
      'second',
      'second',
    ]);
  });
});
