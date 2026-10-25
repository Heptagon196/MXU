import { test } from 'node:test';
import assert from 'node:assert/strict';

test('native stores migrate once, retain edits on IO failure and preserve edits made during save', async () => {
  const legacy = new Map([
    [
      'fgaa.battle-library.v1',
      JSON.stringify({
        version: 1,
        entries: [{ id: 'original', data: { autoskill_name: '旧配置', future: { keep: true } } }],
      }),
    ],
    ['fgaa.global-settings.v1', JSON.stringify({ version: 1, values: { click_duration: 55 } })],
  ]);
  const disk = new Map<string, string>();
  let failWrite = false;
  let delayWrite = false;
  let release: () => void = () => {};
  Object.assign(globalThis, {
    isTauri: true,
    localStorage: {
      getItem: (key: string) => legacy.get(key) ?? null,
      setItem: () => {
        throw new Error('Native saves must not write localStorage');
      },
    },
    window: {
      __TAURI_INTERNALS__: {
        invoke: async (
          command: string,
          args: { key: string; expected?: string | null; value?: string },
        ) => {
          if (command === 'fgaa_read_document') return disk.get(args.key) ?? null;
          assert.equal(command, 'fgaa_save_document');
          if (failWrite) throw new Error('disk full');
          if (delayWrite)
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          assert.equal(args.expected, disk.get(args.key) ?? null);
          disk.set(args.key, args.value!);
        },
      },
    },
  });
  const { useBattleStore } = await import('../src/fgaa/battleStore');
  const { useFgaaSettingsStore, snapshotGlobals } = await import('../src/stores/fgaaSettingsStore');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(useBattleStore.getState().blocked, false);
  assert.equal(useFgaaSettingsStore.getState().blocked, false);
  assert.equal(snapshotGlobals().click_duration, 55);
  assert.equal(disk.get('library'), legacy.get('fgaa.battle-library.v1'));
  assert.equal(legacy.size, 2);
  useBattleStore.getState().update({ autoskill_name: '编辑' });
  failWrite = true;
  await useBattleStore.getState().save();
  assert.equal(useBattleStore.getState().dirty, true);
  assert.match(useBattleStore.getState().error!, /disk full/);
  await assert.rejects(
    useFgaaSettingsStore.getState().save({ ...snapshotGlobals(), click_duration: 99 }),
  );
  assert.equal(snapshotGlobals().click_duration, 55);
  failWrite = false;
  delayWrite = true;
  const pending = useBattleStore.getState().save();
  useBattleStore.getState().update({ autoskill_name: '保存期间继续编辑' });
  release();
  await pending;
  assert.equal(useBattleStore.getState().dirty, true);
  assert.equal(JSON.parse(disk.get('library')!).entries[0].data.autoskill_name, '编辑');
  delayWrite = false;
  await useBattleStore.getState().save();
  assert.equal(useBattleStore.getState().dirty, false);
  assert.deepEqual(JSON.parse(disk.get('library')!).entries[0].data.future, { keep: true });
  await useFgaaSettingsStore.getState().save({ ...snapshotGlobals(), click_duration: 99 });
  assert.equal(JSON.parse(disk.get('globals')!).values.click_duration, 99);
  useFgaaSettingsStore.setState({ blocked: true });
  assert.throws(snapshotGlobals);
  useBattleStore.getState().update({ autoskill_name: '需要保留的草稿' });
  const external = JSON.stringify({
    version: 1,
    entries: [{ id: 'external', data: { autoskill_name: '磁盘新版本' } }],
  });
  disk.set('library', external);
  await useBattleStore.getState().save();
  assert.equal(useBattleStore.getState().dirty, true);
  assert.equal(disk.get('library'), external);
  await useBattleStore.getState().retry();
  assert.equal(useBattleStore.getState().library.entries[0].id, 'external');
  assert.equal(
    useBattleStore.getState().recoveryDraft!.entries[0].data.autoskill_name,
    '需要保留的草稿',
  );
  useBattleStore.getState().restoreDraft();
  const restored = useBattleStore.getState().library.entries;
  assert.equal(restored.length, 2);
  assert.equal(restored[0].data.autoskill_name, '磁盘新版本');
  assert.equal(restored[1].data.autoskill_name, '需要保留的草稿');
  assert.notEqual(restored[1].id, restored[0].id);
  await useBattleStore.getState().save();
  assert.equal(JSON.parse(disk.get('library')!).entries.length, 2);
  const beforeCorruption = useBattleStore.getState().library;
  disk.set('library', 'broken');
  await useBattleStore.getState().retry();
  assert.equal(useBattleStore.getState().blocked, true);
  assert.equal(useBattleStore.getState().library, beforeCorruption);
});
