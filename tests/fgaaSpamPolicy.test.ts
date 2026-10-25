import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSpam, updateSpam } from '../src/fgaa/spamPolicy.ts';

test('spam defaults and edits preserve unknown nested data and untouched slots', () => {
  const values = decodeSpam(
    JSON.stringify([{ future: { keep: true }, skills: [{ extra: 42 }, {}, {}] }]),
  );
  assert.equal(values.length, 6);
  const edited = JSON.parse(
    updateSpam(values, 0, 0, { spam: 'Danger', target: 'Self', waves: [2, 4] }),
  );
  assert.deepEqual(edited[0].future, { keep: true });
  assert.equal(edited[0].skills[0].extra, 42);
  assert.deepEqual(edited[1], values[1]);
  assert.equal(values[0].skills[0].spam, 'None');
  assert.equal(
    JSON.parse(updateSpam(values, 5, null, { spam: 'Spam', waves: [] }))[5].np.spam,
    'Spam',
  );
});

test('spam refuses malformed known values rather than silently replacing imported data', () => {
  for (const source of [
    'null',
    '[null]',
    '[{"skills":[]}]',
    '[{"np":{"waves":[0]}}]',
    '[{"np":{"spam":"Future"}}]',
    '[{"skills":[{"target":"Future"},{},{}]}]',
  ])
    assert.throws(() => decodeSpam(source));
  assert.throws(() => updateSpam(decodeSpam(), 0, 0, { waves: [2147483648] }));
});
