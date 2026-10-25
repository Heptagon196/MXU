import { create } from 'zustand';
import { nativeDocument, nativeStorage } from '@/fgaa/nativeStorage';
import {
  globalDefaults,
  loadGlobals,
  saveGlobals,
  settingsKey,
  validateGlobals,
  type GlobalSettings,
} from '@/fgaa/globalSettings';
function read() {
  try {
    return { values: loadGlobals(localStorage), blocked: false };
  } catch {
    return { values: { ...globalDefaults }, blocked: true };
  }
}
interface State {
  values: GlobalSettings;
  blocked: boolean;
  saving: boolean;
  loading: boolean;
  save(values: GlobalSettings): Promise<void>;
  retry(): Promise<void>;
}
const repository = nativeDocument('globals');
export const useFgaaSettingsStore = create<State>((set, get) => ({
  ...(nativeStorage ? { values: { ...globalDefaults }, blocked: true } : read()),
  saving: false,
  loading: false,
  async save(values) {
    if (get().blocked || get().loading || get().saving) throw new Error('FGA storage is not ready');
    const next = validateGlobals(values);
    set({ saving: true });
    try {
      if (nativeStorage) await repository.save(JSON.stringify({ version: 1, values: next }));
      else saveGlobals(localStorage, next);
      set({ values: { ...next }, blocked: false });
    } finally {
      set({ saving: false });
    }
  },
  async retry() {
    if (get().loading || get().saving) return;
    set({ loading: true });
    try {
      if (nativeStorage) {
        const values = await repository.load(
          () => localStorage.getItem(settingsKey),
          (source) => loadGlobals({ getItem: () => source }),
        );
        set({ values, blocked: false });
      } else set(read());
    } catch {
      set({ blocked: true });
    } finally {
      set({ loading: false });
    }
  },
}));
if (nativeStorage) void useFgaaSettingsStore.getState().retry();
export function snapshotGlobals(): GlobalSettings {
  const state = useFgaaSettingsStore.getState();
  if (state.blocked || state.loading) throw new Error('FGA global settings could not be loaded');
  return { ...state.values };
}
