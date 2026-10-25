import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  importFga,
  exportFga,
  updateEntry,
  loadLibrary,
  saveLibrary,
  decodeLibrary,
  libraryKey,
  type StoragePort,
  type BattleLibrary,
} from '../src/fgaa/battleLibrary.ts';

function storage(): StoragePort {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
test('FGA import/edit/export preserves numeric strings, skills and future nested fields', () => {
  const source = {
    autoskill_name: '素材本',
    autoskill_cmd: 'a(11),0,#,b2',
    autoskill_party: '14',
    shuffle_cards_wave: 3,
    support_friends_only: true,
    battle_config_mat: ['Proof'],
    future: { value: [1, false] },
  };
  const data = importFga(JSON.stringify(source));
  const original: BattleLibrary = {
    version: 1,
    entries: [
      { id: 'one', data },
      { id: 'two', data: importFga(exportFga(data)) },
    ],
  };
  const edited = updateEntry(original, 'two', { autoskill_name: '活动本', autoskill_party: '0' });
  assert.deepEqual(JSON.parse(exportFga(edited.entries[1].data)), {
    ...source,
    autoskill_name: '活动本',
    autoskill_party: '0',
  });
  assert.equal(original.entries[0].data.autoskill_party, '14');
  assert.equal(original.entries[1].data.autoskill_name, '素材本');
});
test('invalid FGA field types and unrelated document formats are rejected', () => {
  for (const value of [
    [],
    null,
    { autoskill_party: 1 },
    { support_friends_only: 'true' },
    { battle_config_mat: [1] },
    { format: 'fgaa.skill-plan' },
  ]) {
    assert.throws(() => importFga(JSON.stringify(value)));
  }
  assert.deepEqual(importFga('{"format":"future FGA extension"}'), {
    format: 'future FGA extension',
  });
});
test('library reload restores independent configurations and keeps the previous valid version', () => {
  const port = storage();
  const initial: BattleLibrary = {
    version: 1,
    entries: [{ id: 'one', data: { autoskill_name: 'first' } }],
  };
  saveLibrary(port, initial);
  const edited = updateEntry(initial, 'one', { autoskill_name: 'second' });
  saveLibrary(port, edited);
  assert.deepEqual(loadLibrary(port), edited);
  assert.deepEqual(decodeLibrary(port.getItem(`${libraryKey}.bak`)!), initial);
});
test('corrupt original library is never overwritten by a new save', () => {
  const port = storage();
  port.setItem(libraryKey, '{corrupt');
  assert.throws(() => loadLibrary(port));
  assert.throws(() => saveLibrary(port, { version: 1, entries: [] }));
  assert.equal(port.getItem(libraryKey), '{corrupt');
});
test('duplicate identifiers and invalid selected entries cannot overwrite another configuration', () => {
  assert.throws(() =>
    decodeLibrary(
      JSON.stringify({
        version: 1,
        entries: [
          { id: 'same', data: {} },
          { id: 'same', data: {} },
        ],
      }),
    ),
  );
  assert.throws(() => updateEntry({ version: 1, entries: [] }, 'missing', {}));
});
