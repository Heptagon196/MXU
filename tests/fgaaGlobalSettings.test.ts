import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  globalDefaults,
  loadGlobals,
  saveGlobals,
  settingsKey,
  validateGlobals,
} from '../src/fgaa/globalSettings.ts';
import { createFgaInterface, fgaTaskOverride } from '../src/fgaa/taskInterface.ts';
test('global storage rejects corrupt data without overwriting and backs up previous values', () => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
  assert.deepEqual(loadGlobals(storage), globalDefaults);
  saveGlobals(storage, { ...globalDefaults, skill_delay: 750 });
  const before = storage.getItem(settingsKey);
  saveGlobals(storage, { ...globalDefaults, skill_delay: 900 });
  assert.equal(storage.getItem(`${settingsKey}.bak`), before);
  assert.equal(loadGlobals(storage).skill_delay, 900);
  storage.setItem(settingsKey, '{broken');
  assert.throws(() => saveGlobals(storage, globalDefaults));
  assert.equal(storage.getItem(settingsKey), '{broken');
  for (const change of [
    { skill_delay: '20' },
    { min_similarity: 101 },
    { selected_boost_item: -2 },
    { wait_multiplier: 1.5 },
    { unknown: true },
  ])
    assert.throws(() => validateGlobals({ ...globalDefaults, ...change }));
});
test('task snapshots freeze supplied globals and later tasks receive changed values', () => {
  const task = {
    id: 'task-1',
    taskName: 'FGAA.FP',
    enabled: true,
    expanded: true,
    optionValues: {},
  };
  const globals = { ...globalDefaults, skill_delay: 750 };
  const first = fgaTaskOverride(task, createFgaInterface(), globals);
  globals.skill_delay = 900;
  const second = fgaTaskOverride(task, createFgaInterface(), globals);
  assert.equal(JSON.parse(first)[0].FGAA_FP.custom_action_param.globals.skill_delay, 750);
  assert.equal(JSON.parse(second)[0].FGAA_FP.custom_action_param.globals.skill_delay, 900);
});
