import { create } from 'zustand';
import {
  loadLibrary,
  saveLibrary,
  updateEntry,
  validateFga,
  type BattleLibrary,
  type FgaConfig,
} from './battleLibrary';

interface BattleState {
  library: BattleLibrary;
  selectedId: string | null;
  dirty: boolean;
  error: string | null;
  blocked: boolean;
  select(id: string): void;
  add(data: FgaConfig): void;
  update(changes: FgaConfig): void;
  save(): void;
  retry(): void;
}
function read() {
  try {
    return { library: loadLibrary(localStorage), error: null, blocked: false };
  } catch (error) {
    return { library: { version: 1 as const, entries: [] }, error: String(error), blocked: true };
  }
}
const initial = read();
export const useBattleStore = create<BattleState>((set, get) => ({
  ...initial,
  selectedId: initial.library.entries[0]?.id ?? null,
  dirty: false,
  select: (id) => set({ selectedId: id }),
  add: (data) => {
    if (get().blocked) return;
    const entry = { id: crypto.randomUUID(), data: validateFga(data) };
    set({
      library: { version: 1, entries: [...get().library.entries, entry] },
      selectedId: entry.id,
      dirty: true,
    });
  },
  update: (changes) => {
    const { selectedId, library, blocked } = get();
    if (!selectedId || blocked) return;
    set({ library: updateEntry(library, selectedId, changes), dirty: true });
  },
  save: () => {
    if (get().blocked) return;
    try {
      saveLibrary(localStorage, get().library);
      set({ dirty: false, error: null });
    } catch (error) {
      set({ error: String(error) });
    }
  },
  retry: () => {
    if (!get().blocked) return;
    const state = read();
    set({ ...state, selectedId: state.library.entries[0]?.id ?? null });
  },
}));
