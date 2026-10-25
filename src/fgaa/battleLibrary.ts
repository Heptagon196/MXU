export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
export type FgaConfig = { [key: string]: JsonValue };
export interface BattleEntry {
  id: string;
  data: FgaConfig;
}
export interface BattleLibrary {
  version: 1;
  entries: BattleEntry[];
}
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const libraryKey = 'fgaa.battle-library.v1';

const stringFields = new Set([
  'autoskill_name',
  'autoskill_cmd',
  'autoskill_notes',
  'card_priority',
  'auto_skill_rearrange_cards',
  'auto_skill_brave_chains',
  'shuffle_cards',
  'servant_priority',
  'spam_x',
  'autoskill_party',
  'battle_config_server',
  'raid_delay_seconds',
  'support_mode',
  'support_fallback',
  'autoskill_support_class',
  'support_bond_ce_effect',
]);
const booleanFields = new Set([
  'use_servant_priority',
  'auto_choose_target',
  'add_raid_delay',
  'support_pref_ce_mlb',
  'support_friends_only',
  'also_check_all',
  'support_max_ascended',
  'support_skill_max_1',
  'support_skill_max_2',
  'support_skill_max_3',
  'support_grand_servant',
  'support_require_both_normal_and_reward_match',
]);
const listFields = new Set([
  'battle_config_mat',
  'support_friend_names_list',
  'support_pref_servant_list',
  'support_pref_ce_list',
]);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function validateFga(value: unknown): FgaConfig {
  if (!record(value) || value.format === 'fgaa.battle-config' || value.format === 'fgaa.skill-plan')
    throw new Error('invalidFga');
  for (const [key, item] of Object.entries(value)) {
    if (
      (stringFields.has(key) && typeof item !== 'string') ||
      (booleanFields.has(key) && typeof item !== 'boolean') ||
      (key === 'shuffle_cards_wave' && !Number.isInteger(item)) ||
      (listFields.has(key) && (!Array.isArray(item) || item.some((v) => typeof v !== 'string')))
    ) {
      throw new Error(`invalidField:${key}`);
    }
  }
  // Source is JSON or a controlled edit. Clone it so unknown nested data cannot
  // be mutated through a shared reference when copying a configuration.
  return JSON.parse(JSON.stringify(value)) as FgaConfig;
}
export function importFga(source: string): FgaConfig {
  if (source.length > 2 * 1024 * 1024) throw new Error('fileTooLarge');
  return validateFga(JSON.parse(source));
}
export function exportFga(data: FgaConfig): string {
  return JSON.stringify(validateFga(data), null, 2);
}
export function decodeLibrary(source: string): BattleLibrary {
  const value: unknown = JSON.parse(source);
  if (
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.entries) ||
    Object.keys(value).some((key) => !['version', 'entries'].includes(key))
  )
    throw new Error('invalidLibrary');
  const ids = new Set<string>();
  const entries = value.entries.map((entry) => {
    if (
      !record(entry) ||
      typeof entry.id !== 'string' ||
      !entry.id ||
      ids.has(entry.id) ||
      Object.keys(entry).some((key) => !['id', 'data'].includes(key))
    )
      throw new Error('invalidLibrary');
    ids.add(entry.id);
    return { id: entry.id, data: validateFga(entry.data) };
  });
  return { version: 1, entries };
}
export function loadLibrary(storage: StoragePort): BattleLibrary {
  const source = storage.getItem(libraryKey);
  return source === null ? { version: 1, entries: [] } : decodeLibrary(source);
}
export function saveLibrary(storage: StoragePort, library: BattleLibrary): void {
  const source = JSON.stringify(library);
  decodeLibrary(source);
  const previous = storage.getItem(libraryKey);
  if (previous !== null) {
    decodeLibrary(previous); // Corrupt originals must never be overwritten silently.
    storage.setItem(`${libraryKey}.bak`, previous);
  }
  storage.setItem(libraryKey, source);
}
export function updateEntry(library: BattleLibrary, id: string, changes: FgaConfig): BattleLibrary {
  if (!library.entries.some((entry) => entry.id === id)) throw new Error('missingEntry');
  return {
    version: 1,
    entries: library.entries.map((entry) =>
      entry.id === id ? { id, data: validateFga({ ...entry.data, ...changes }) } : entry,
    ),
  };
}
