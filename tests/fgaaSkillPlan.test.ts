import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, planCommand, insertAttack, insertAction } from '../src/fgaa/skillPlan.ts';

test('skill plans preserve repeated targets and ordered NP attacks', () => {
  const source = 'a(11[Ch2A])j2o3t1x134n1,0,#,b8';
  assert.equal(planCommand(parseCommand(source)), source);
  assert.deepEqual(parseCommand('664n1')[0][0], [
    { type: 'attack', nps: ['6', '4'], cardsBeforeNP: 1 },
  ]);
});
test('inserting a wave boundary moves the tail and later turns without mutating input', () => {
  const original = parseCommand('ab,c,#,d');
  const next = insertAttack(original, 0, 0, 1, { type: 'attack', nps: [], cardsBeforeNP: 0 }, true);
  assert.equal(planCommand(next), 'a0,#,b,c,#,d');
  assert.equal(planCommand(original), 'ab,c,#,d');
  assert.equal(
    planCommand(insertAction(original, 0, 0, 1, { type: 'enemyTarget', target: '2' })),
    'at2b,c,#,d',
  );
});
test('unsupported syntax and invalid attacks fail without rewriting the source', () => {
  for (const source of ['a[unknown]', 'a(1', 'n3', 'n ', 'n1n2', 't4', 'x14'])
    assert.throws(() => parseCommand(source));
});
