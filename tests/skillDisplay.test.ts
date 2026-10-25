import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enterSkillDisplay } from '../src/fgaa/skillDisplay';

test('native display releases its own lease even when entry resolves after closing', async (t) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalTauri = Object.getOwnPropertyDescriptor(globalThis, 'isTauri');
  t.after(() => {
    for (const [name, descriptor] of [
      ['window', originalWindow],
      ['isTauri', originalTauri],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  });
  let resolveEntry!: (token: number) => void;
  const released: number[] = [];
  Object.defineProperty(globalThis, 'isTauri', { configurable: true, value: true });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      __TAURI_INTERNALS__: {
        invoke: (command: string, args: { token?: number }) => {
          if (command === 'fgaa_enter_skill_display') {
            return new Promise<number>((resolve) => {
              resolveEntry = resolve;
            });
          }
          assert.equal(command, 'fgaa_leave_skill_display');
          released.push(args.token!);
          return Promise.resolve();
        },
      },
      matchMedia: () => {
        throw new Error('Native display must not use browser fullscreen');
      },
    },
  });
  const pending = enterSkillDisplay();
  const closed = pending.then((release) => release());
  assert.deepEqual(released, []);
  resolveEntry(7);
  await closed;
  assert.deepEqual(released, [7]);
});
