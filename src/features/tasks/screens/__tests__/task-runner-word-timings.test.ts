import { getActiveWordTimingId, getTokenWordTimingIds } from '../task-runner-word-timings';
import { tokenizeLessonText } from '../task-runner-words';

describe('task runner word timings', () => {
  it('maps tokens to word timing ids in reading order', () => {
    const text = 'Go now, then go again.';
    const tokens = tokenizeLessonText(text);

    expect(
      getTokenWordTimingIds(tokens, text, [
        { id: 'go-1', text: 'Go', startMs: 0, endMs: 200 },
        { id: 'now', text: 'now', startMs: 200, endMs: 450 },
        { id: 'go-2', text: 'go', startMs: 700, endMs: 900 },
      ]),
    ).toEqual(['go-1', null, 'now', null, null, null, null, 'go-2', null, null, null]);
  });

  it('returns the active word timing for the current audio position', () => {
    expect(
      getActiveWordTimingId(
        [
          { id: 'first', text: 'First', startMs: 100, endMs: 300 },
          { id: 'second', text: 'second', startMs: 300, endMs: 600 },
        ],
        300,
      ),
    ).toBe('second');
  });
});
