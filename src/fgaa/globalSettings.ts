import defaults from './globalDefaults.json' with { type: 'json' };
export const globalDefaults = defaults;
export type GlobalSettings = typeof defaults;
export type GlobalKey = keyof GlobalSettings;
export const globalKeys = Object.keys(defaults) as GlobalKey[];
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
