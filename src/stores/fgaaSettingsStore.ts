import { create } from 'zustand';
import {
  globalDefaults,
  loadGlobals,
  saveGlobals,
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
  save(values: GlobalSettings): void;
  retry(): void;
}
export const useFgaaSettingsStore = create<State>((set) => ({
  ...read(),
  save(values) {
    saveGlobals(localStorage, values);
    set({ values: { ...values }, blocked: false });
  },
  retry() {
    set(read());
  },
}));
export function snapshotGlobals(): GlobalSettings {
  const state = useFgaaSettingsStore.getState();
  if (state.blocked) throw new Error('FGA global settings could not be loaded');
  return { ...state.values };
}
