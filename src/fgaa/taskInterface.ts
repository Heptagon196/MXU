import type {
  ProjectInterface,
  OptionDefinition,
  SelectedTask,
  OptionValue,
} from '@/types/interface';
import type { BattleLibrary, FgaConfig } from './battleLibrary';

export const launcherDefaults: Record<string, Record<string, string | number | boolean>> = {
  Battle: {
    battle_config: '',
    refill_resource: 'none',
    refill_count: 0,
    wait_for_ap_regeneration: false,
    should_limit_runs: false,
    limit_runs: 1,
    should_limit_mats: false,
    limit_mats: 1,
    should_limit_ces: false,
    limit_ces: 1,
  },
  FP: { should_fp_limit: false, fp_limit: 1 },
  Lottery: {
    receive_embers_when_gift_box_full: false,
    max_gold_ember_set_size: 1,
    max_gold_ember_total_count: 100,
  },
  PresentBox: { max_gold_ember_set_size: 1, max_gold_ember_total_count: 100 },
  CEBomb: { ce_bomb_target_rarity: 1 },
  ServantLevel: {
    level_redirect_servant_ascension: false,
    level_perform_servant_ascension: false,
    level_redirect_servant_grail: false,
  },
  SupportImageMaker: {},
};
export const taskServers = ['En', 'En BFGO', 'Jp', 'Jp BFGO', 'Cn', 'Tw', 'Kr'];
export const refillResources = ['none', 'Copper', 'Bronze', 'Silver', 'Gold', 'SQ'];
export const taskOptionKey = (mode: string, field: string) => `FGAA.${mode}.${field}`;
export function parameterBounds(field: string): [number, number] {
  return [
    field === 'refill_count' || field === 'max_gold_ember_set_size' ? 0 : 1,
    field === 'ce_bomb_target_rarity'
      ? 2
      : field === 'max_gold_ember_set_size'
        ? 100
        : field === 'max_gold_ember_total_count'
          ? 600
          : 999,
  ];
}

/** Standard MXU task/option definitions; launch values belong to SelectedTask.optionValues. */
export function createFgaInterface(): ProjectInterface {
  const option: Record<string, OptionDefinition> = {};
  const task = Object.entries(launcherDefaults).map(([mode, defaults]) => {
    const keys = Object.keys(defaults).map((field) => taskOptionKey(mode, field));
    const serverKey = taskOptionKey(mode, 'server');
    option[serverKey] = {
      type: 'select',
      label: '$tasks.server',
      default_case: 'Cn',
      cases: taskServers.map((server) => ({ name: server, label: `$settings.options.${server}` })),
    };
    for (const [field, value] of Object.entries(defaults)) {
      const key = taskOptionKey(mode, field);
      if (typeof value === 'boolean')
        option[key] = {
          type: 'switch',
          label: `$tasks.${field}`,
          default_case: 'No',
          cases: [
            { name: 'No', label: '$tasks.off' },
            { name: 'Yes', label: '$tasks.on' },
          ],
        };
      else if (typeof value === 'number') {
        const [min, max] = parameterBounds(field);
        option[key] = {
          type: 'input',
          label: `$tasks.${field}`,
          inputs: [
            {
              name: 'value',
              label: `$tasks.${field}`,
              default: String(value),
              pipeline_type: 'int',
              verify: `^(?:${Array.from({ length: max - min + 1 }, (_, i) => i + min).join('|')})$`,
              pattern_msg: '$tasks.invalidNumber',
            },
          ],
        };
      } else
        option[key] = {
          type: 'select',
          label: `$tasks.${field}`,
          default_case: value,
          cases:
            field === 'refill_resource'
              ? refillResources.map((name) => ({ name, label: `$tasks.refill.${name}` }))
              : [{ name: '', label: '$tasks.chooseBattle' }],
        };
    }
    const dependent = new Set<string>();
    const gated: Record<string, string[]> = {
      should_limit_runs: ['limit_runs'],
      should_limit_mats: ['limit_mats'],
      should_limit_ces: ['limit_ces'],
      should_fp_limit: ['fp_limit'],
      receive_embers_when_gift_box_full: ['max_gold_ember_set_size', 'max_gold_ember_total_count'],
    };
    for (const [flag, fields] of Object.entries(gated)) {
      const definition = option[taskOptionKey(mode, flag)];
      if (definition?.type !== 'switch') continue;
      definition.cases[1].option = fields.map((field) => taskOptionKey(mode, field));
      fields.forEach((field) => dependent.add(taskOptionKey(mode, field)));
    }
    return {
      name: `FGAA.${mode}`,
      label: `$tasks.modes.${mode}`,
      description: '$tasks.pendingEngine',
      entry: `FGAA_${mode}`,
      default_check: false,
      option: [serverKey, ...keys.filter((key) => !dependent.has(key))],
    };
  });
  return {
    interface_version: 2,
    name: 'FGAA',
    label: 'FGAA',
    version: '0.1.0',
    controller: [{ name: 'Android', type: 'Adb', display_short_side: 720 }],
    resource: [{ name: 'FGA', path: ['./resource'] }],
    task,
    option,
  };
}

export function withBattleChoices(pi: ProjectInterface, library: BattleLibrary): ProjectInterface {
  if (pi.name !== 'FGAA' || !pi.option?.[taskOptionKey('Battle', 'battle_config')]) return pi;
  return {
    ...pi,
    option: {
      ...pi.option,
      [taskOptionKey('Battle', 'battle_config')]: {
        type: 'select',
        label: '$tasks.battle_config',
        default_case: '',
        cases: [
          { name: '', label: '$tasks.chooseBattle' },
          ...library.entries.map((entry) => ({
            name: entry.id,
            label: String(entry.data.autoskill_name || entry.id),
            pipeline_override: {
              FGAA_Battle: { custom_action_param: { battleConfig: structuredClone(entry.data) } },
            },
          })),
        ],
      },
    },
  };
}

function resolveValue(
  value: OptionValue | undefined,
  fallback: string | number | boolean,
  field: string,
): string | number | boolean {
  if (value === undefined) return fallback;
  if (typeof fallback === 'boolean' && value.type === 'switch') return value.value;
  if (typeof fallback === 'string' && value.type === 'select') return value.caseName;
  if (typeof fallback === 'number' && value.type === 'input') {
    const raw = value.values.value;
    const number = Number(raw);
    const [min, max] = parameterBounds(field);
    if (/^\d+$/.test(raw ?? '') && Number.isSafeInteger(number) && number >= min && number <= max)
      return number;
  }
  throw new Error(`Invalid FGA task parameter: ${field}`);
}

/** One full override avoids Maa's replacement of successive custom_action_param objects. */
export function fgaTaskOverride(selected: SelectedTask, pi: ProjectInterface): string {
  const mode = selected.taskName.slice('FGAA.'.length);
  const defaults = launcherDefaults[mode];
  if (!defaults || pi.name !== 'FGAA') throw new Error('Unknown FGA task');
  const launcher = Object.fromEntries(
    Object.entries(defaults).map(([field, fallback]) => [
      field,
      resolveValue(selected.optionValues[taskOptionKey(mode, field)], fallback, field),
    ]),
  );
  const server = resolveValue(
    selected.optionValues[taskOptionKey(mode, 'server')],
    'Cn',
    'server',
  ) as string;
  if (!taskServers.includes(server)) throw new Error('Unknown FGA server');
  let battleConfig: FgaConfig = {};
  if (mode === 'Battle') {
    if (!refillResources.includes(String(launcher.refill_resource)))
      throw new Error('Unknown refill resource');
    const definition = pi.option?.[taskOptionKey(mode, 'battle_config')];
    const choice =
      definition && 'cases' in definition
        ? definition.cases.find((item) => item.name === launcher.battle_config)
        : undefined;
    const node = choice?.pipeline_override?.FGAA_Battle as
      | { custom_action_param?: { battleConfig?: FgaConfig } }
      | undefined;
    if (!launcher.battle_config || !node?.custom_action_param?.battleConfig)
      throw new Error('Select an existing FGA battle configuration');
    battleConfig = node.custom_action_param.battleConfig;
    const configServer = battleConfig.battle_config_server;
    if (configServer && String(configServer).replace(' BFGO', '') !== server.replace(' BFGO', ''))
      throw new Error('Battle configuration server does not match task');
  }
  return JSON.stringify([
    {
      [`FGAA_${mode}`]: {
        action: 'Custom',
        custom_action: 'FGAA_RUN',
        custom_action_param: {
          protocol: 1,
          taskId: selected.id,
          mode,
          server,
          launcher,
          battleConfig,
        },
      },
    },
  ]);
}
