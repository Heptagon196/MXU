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
  undoStacks: Record<string, FgaConfig[]>;
  redoStacks: Record<string, FgaConfig[]>;
  select(id: string): void;
  add(data: FgaConfig): void;
  update(changes: FgaConfig): void;
  save(): void;
  retry(): void;
  undo(): void;
  redo(): void;
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
  undoStacks: {},
  redoStacks: {},
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
    const previous = library.entries.find((entry) => entry.id === selectedId)!.data;
    set({
      library: updateEntry(library, selectedId, changes),
      dirty: true,
      undoStacks: {
        ...get().undoStacks,
        [selectedId]: [...(get().undoStacks[selectedId] ?? []), previous].slice(-100),
      },
      redoStacks: { ...get().redoStacks, [selectedId]: [] },
    });
  },
  undo: () => {
    const { selectedId, library, undoStacks, redoStacks } = get();
    if (!selectedId || !undoStacks[selectedId]?.length) return;
    const previous = undoStacks[selectedId][undoStacks[selectedId].length - 1];
    const current = library.entries.find((entry) => entry.id === selectedId)!.data;
    set({
      library: {
        version: 1,
        entries: library.entries.map((entry) =>
          entry.id === selectedId ? { ...entry, data: previous } : entry,
        ),
      },
      dirty: true,
      undoStacks: { ...undoStacks, [selectedId]: undoStacks[selectedId].slice(0, -1) },
      redoStacks: { ...redoStacks, [selectedId]: [...(redoStacks[selectedId] ?? []), current] },
    });
  },
  redo: () => {
    const { selectedId, library, undoStacks, redoStacks } = get();
    if (!selectedId || !redoStacks[selectedId]?.length) return;
    const next = redoStacks[selectedId][redoStacks[selectedId].length - 1];
    const current = library.entries.find((entry) => entry.id === selectedId)!.data;
    set({
      library: {
        version: 1,
        entries: library.entries.map((entry) =>
          entry.id === selectedId ? { ...entry, data: next } : entry,
        ),
      },
      dirty: true,
      redoStacks: { ...redoStacks, [selectedId]: redoStacks[selectedId].slice(0, -1) },
      undoStacks: { ...undoStacks, [selectedId]: [...(undoStacks[selectedId] ?? []), current] },
    });
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
