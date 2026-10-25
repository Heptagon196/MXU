import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRuntimeEvent, parseRuntimeEvent, type RuntimeEvent } from '../src/fgaa/runtimeEvents';
import { useFgaaRuntimeStore } from '../src/stores/fgaaRuntimeStore';

const id = '12345678-1234-1234-1234-123456789abc';
function event(
  type: RuntimeEvent['event'],
  sequence: number,
  payload: Record<string, unknown>,
  runId = id,
): RuntimeEvent {
  return {
    protocol: 1,
    event: type,
    sequence,
    payload,
    runId,
    nativeTaskId: 5,
    time: '2026-10-26T00:00:00Z',
  };
}
const start = event('started', 1, { taskId: 'task-one', mode: 'FP' });
const finish = event('finished', 3, { status: 'attention', reason: 'inventory_full', details: {} });

test('output closure fails only the matching unfinished run and cannot corrupt a replacement', () => {
  useFgaaRuntimeStore.setState({ instances: {} });
  const store = useFgaaRuntimeStore.getState();
  store.consume('a', JSON.stringify(start));
  store.consume('b', JSON.stringify(start));
  for (const payload of ['null', 'bad', '{}', JSON.stringify({ runId: id, nativeTaskId: 9 })])
    store.outputClosed('a', payload);
  assert.equal(useFgaaRuntimeStore.getState().instances.a[0].status, 'running');
  store.outputClosed('a', JSON.stringify({ runId: id, nativeTaskId: 5 }));
  let runs = useFgaaRuntimeStore.getState().instances.a;
  assert.equal(runs[0].status, 'failed');
  assert.equal(runs[0].reason, 'agent_output_closed');
  assert.equal(runs[0].incomplete, true);
  assert.equal(useFgaaRuntimeStore.getState().instances.b[0].status, 'running');
  const replacement = { ...start, runId: '22345678-1234-1234-1234-123456789abc' };
  store.consume('a', JSON.stringify(replacement));
  store.outputClosed('a', JSON.stringify({ runId: id, nativeTaskId: 5 }));
  runs = useFgaaRuntimeStore.getState().instances.a;
  assert.equal(runs[1].status, 'running');
  store.consume('a', JSON.stringify({ ...finish, runId: replacement.runId }));
  store.outputClosed('a', JSON.stringify({ runId: replacement.runId, nativeTaskId: 5 }));
  assert.equal(useFgaaRuntimeStore.getState().instances.a[1].status, 'attention');
});

test('batched task events bypass ordinary logs and keep instances isolated', () => {
  useFgaaRuntimeStore.setState({ instances: {} });
  const message = event('notify', 2, { code: 'BetweenRuns', runs: 2 });
  const remaining = useFgaaRuntimeStore
    .getState()
    .consume(
      'a',
      [
        JSON.stringify(start),
        'ordinary stderr',
        JSON.stringify(message),
        JSON.stringify(finish),
      ].join('\n'),
    );
  assert.equal(remaining, 'ordinary stderr');
  const runs = useFgaaRuntimeStore.getState().instances.a;
  assert.equal(runs[0].status, 'attention');
  assert.equal(runs[0].incomplete, false);
  assert.equal(runs[0].messages.length, 1);
  useFgaaRuntimeStore.getState().consume('b', JSON.stringify(start));
  assert.equal(useFgaaRuntimeStore.getState().instances.a[0].status, 'attention');
  assert.equal(useFgaaRuntimeStore.getState().instances.b[0].status, 'running');
});

test('duplicates, late events and foreign native task ids cannot overwrite terminal state', () => {
  let runs = applyRuntimeEvent([], start);
  assert.equal(applyRuntimeEvent(runs, start), runs);
  assert.equal(applyRuntimeEvent(runs, { ...finish, nativeTaskId: 99 }), runs);
  runs = applyRuntimeEvent(runs, finish);
  assert.equal(runs[0].incomplete, true);
  assert.equal(
    applyRuntimeEvent(runs, {
      ...finish,
      sequence: 4,
      payload: { status: 'completed', reason: 'fp_limit', details: {} },
    }),
    runs,
  );
  assert.equal(applyRuntimeEvent([], finish).length, 0);
});

test('malformed versions and payloads are not consumed as task events', () => {
  for (const value of [
    { ...start, protocol: 2 },
    { ...start, sequence: 2 },
    { ...start, runId: 'bad' },
    { ...finish, payload: { status: 'running' } },
    { ...start, time: 'bad' },
  ]) {
    assert.equal(parseRuntimeEvent(JSON.stringify(value)), null);
  }
  assert.equal(parseRuntimeEvent('not JSON'), null);
  assert.deepEqual(parseRuntimeEvent(JSON.stringify(start)), start);
});

test('run and message histories remain bounded', () => {
  let runs = applyRuntimeEvent([], start);
  for (let sequence = 2; sequence <= 202; sequence++)
    runs = applyRuntimeEvent(runs, event('log', sequence, { code: 'CurrentParty', party: 1 }));
  assert.equal(runs[0].messages.length, 100);
  for (let i = 0; i < 30; i++) runs = applyRuntimeEvent(runs, { ...start, runId: `${i}` });
  assert.equal(runs.length, 20);
});
