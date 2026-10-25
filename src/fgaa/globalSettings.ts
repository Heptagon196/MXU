import defaults from './globalDefaults.json' with { type: 'json' };
export const globalDefaults = defaults;
export type GlobalSettings = typeof defaults;
export type GlobalKey = keyof GlobalSettings;
export const globalKeys = Object.keys(defaults) as GlobalKey[];
export const globalGroups: Record<string, GlobalKey[]> = {
  battle: [
    'story_skip',
    'withdraw_enabled',
    'stop_on_ce_get',
    'stop_on_first_clear_rewards',
    'selected_boost_item',
    'hide_sq_in_ap_resources',
    'skip_servant_face_card_check',
  ],
  support: [
    'support_swipes_per_update_x',
    'support_max_updates_x',
    'treat_support_like_own_servant',
  ],
  recognition: [
    'min_similarity',
    'mlb_similarity',
    'stage_counter_similarity',
    'stage_counter_new',
  ],
  timing: [
    'skill_delay',
    'wait_multiplier',
    'wait_before_turn',
    'wait_before_cards',
    'click_wait_time',
    'click_duration',
    'click_delay',
    'swipe_wait_time',
    'swipe_duration',
    'swipe_multiplier',
  ],
  capture: [
    'record_screen',
    'screenshot_drops',
    'screenshot_drops_unmodified',
    'screenshot_bond',
    'debug_mode',
  ],
};
export const settingsKey = 'fgaa.global-settings.v1';
export function bounds(key: GlobalKey): [number, number] {
  return key === 'selected_boost_item'
    ? [-1, 3]
    : key.includes('similarity')
      ? [0, 100]
      : [0, 2147483647];
}
export function validateGlobals(value: unknown): GlobalSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid global settings');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !globalKeys.includes(key as GlobalKey)))
    throw new Error('Unknown global setting');
  const merged = { ...defaults, ...data };
  for (const key of globalKeys) {
    const item = merged[key];
    if (typeof item !== typeof defaults[key]) throw new Error(`Invalid setting: ${key}`);
    if (typeof item === 'number') {
      const [min, max] = bounds(key);
      if (!Number.isInteger(item) || item < min || item > max)
        throw new Error(`Invalid setting: ${key}`);
    }
  }
  return merged as GlobalSettings;
}
export function loadGlobals(storage: Pick<Storage, 'getItem'>): GlobalSettings {
  const raw = storage.getItem(settingsKey);
  if (raw === null) return { ...defaults };
  const document = JSON.parse(raw);
  if (document.version !== 1) throw new Error('Unsupported settings version');
  return validateGlobals(document.values);
}
export function saveGlobals(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  values: GlobalSettings,
): void {
  const validated = validateGlobals(values);
  loadGlobals(storage); // Never overwrite unreadable settings.
  const previous = storage.getItem(settingsKey);
  if (previous !== null) storage.setItem(`${settingsKey}.bak`, previous);
  storage.setItem(settingsKey, JSON.stringify({ version: 1, values: validated }));
}
