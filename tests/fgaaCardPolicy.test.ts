import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priorityRows, serializePriority, movePriority } from '../src/fgaa/cardPolicy.ts';

test('priority movement preserves other waves and emits FGA-compatible servant integers', () => {
  const rows = priorityRows('1,2,3,4,5,6\n6,5,4,3,2,1', true);
  const next = movePriority(rows, 0, 1, 0);
  assert.equal(serializePriority(next), '2,1,3,4,5,6\n6,5,4,3,2,1');
  assert.equal(rows[0][0], '1');
  assert.throws(() => priorityRows('1, 2,3,4,5,6', true));
});

test('card priorities accept original normal-affinity aliases but reject incomplete rows', () => {
  assert.equal(priorityRows('WB, WA, WQ, XB, XA, XQ, RB, RA, RQ')[0][3], 'B');
  assert.equal(priorityRows('')[0].length, 9);
  assert.throws(() => priorityRows('B,A,Q'));
  assert.throws(() => priorityRows('WB,WA,WQ,B,A,Q,RB,RA,unknown'));
});
