import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFgaInterface,
  withBattleChoices,
  fgaTaskOverride,
  taskOptionKey,
  launcherDefaults,
} from '../src/fgaa/taskInterface.ts';
import type { SelectedTask } from '../src/types/interface.ts';

const task = (mode: string): SelectedTask => ({
  id: 'task-1',
  taskName: `FGAA.${mode}`,
  enabled: true,
  expanded: true,
  optionValues: {},
});
test('seven FGA modes expose launch values only as per-task options', () => {
  const pi = createFgaInterface();
  assert.equal(pi.task.length, 7);
  assert.equal(pi.global_option, undefined);
  for (const mode of Object.keys(launcherDefaults)) {
    for (const field of Object.keys(launcherDefaults[mode]))
      assert.ok(pi.option?.[taskOptionKey(mode, field)]);
    if (mode !== 'Battle')
      assert.equal(
        JSON.parse(fgaTaskOverride(task(mode), pi))[0][`FGAA_${mode}`].custom_action_param.mode,
        mode,
      );
  }
  assert.ok(!pi.task[0].option!.includes(taskOptionKey('Battle', 'limit_runs')));
  const limit = pi.option![taskOptionKey('Battle', 'should_limit_runs')];
  assert.equal(limit.type, 'switch');
  if (limit.type === 'switch')
    assert.deepEqual(limit.cases[1].option, [taskOptionKey('Battle', 'limit_runs')]);
});
test('one full task snapshot retains independent launcher fields and battle data', () => {
  const pi = withBattleChoices(createFgaInterface(), {
    version: 1,
    entries: [
      {
        id: 'battle-1',
        data: { autoskill_name: 'test', autoskill_cmd: 'a1', battle_config_server: 'Cn' },
      },
    ],
  });
  const first = task('Battle');
  first.optionValues[taskOptionKey('Battle', 'battle_config')] = {
    type: 'select',
    caseName: 'battle-1',
  };
  first.optionValues[taskOptionKey('Battle', 'refill_count')] = {
    type: 'input',
    values: { value: '5' },
  };
  first.optionValues[taskOptionKey('Battle', 'should_limit_runs')] = {
    type: 'switch',
    value: true,
  };
  first.optionValues[taskOptionKey('Battle', 'limit_runs')] = {
    type: 'input',
    values: { value: '12' },
  };
  const copy = structuredClone(first);
  copy.id = 'task-2';
  copy.optionValues[taskOptionKey('Battle', 'limit_runs')] = {
    type: 'input',
    values: { value: '30' },
  };
  const output = JSON.parse(fgaTaskOverride(first, pi));
  assert.equal(output.length, 1);
  const request = output[0].FGAA_Battle.custom_action_param;
  assert.equal(request.launcher.refill_count, 5);
  assert.equal(request.launcher.limit_runs, 12);
  assert.equal(request.launcher.should_limit_runs, true);
  assert.equal(request.battleConfig.autoskill_cmd, 'a1');
  assert.equal(
    JSON.parse(fgaTaskOverride(copy, pi))[0].FGAA_Battle.custom_action_param.launcher.limit_runs,
    30,
  );
  first.optionValues[taskOptionKey('Battle', 'server')] = { type: 'select', caseName: 'Jp' };
  assert.throws(() => fgaTaskOverride(first, pi), /server/);
});
test('missing configs and malformed launch numbers fail before execution', () => {
  assert.throws(() => fgaTaskOverride(task('Battle'), createFgaInterface()), /configuration/);
  const fp = task('FP');
  for (const value of ['0', '1000', '1.5', '', 'NaN']) {
    fp.optionValues[taskOptionKey('FP', 'fp_limit')] = { type: 'input', values: { value } };
    assert.throws(() => fgaTaskOverride(fp, createFgaInterface()));
  }
});
