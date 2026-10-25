import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForNativeHost } from '../src/fgaa/nativeStartup';

test('startup retries a lost callback and setup-not-ready response before mounting', async () => {
  let calls = 0;
  await waitForNativeHost(
    () => {
      calls++;
      if (calls === 1) return new Promise<string>(() => {});
      if (calls === 2) return Promise.reject(new Error('Mobile paths not initialized'));
      return Promise.resolve('/data/user/0/com.misteo.mxu');
    },
    5,
    4,
  );
  assert.equal(calls, 3);
});

test('startup stops waiting when native callbacks never return', async () => {
  await assert.rejects(
    waitForNativeHost(() => new Promise(() => {}), 5, 2),
    /启动/,
  );
});
