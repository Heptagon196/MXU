import { create } from 'zustand';
import { nativeDocument, nativeStorage } from './nativeStorage';
import {
  loadLibrary,
  saveLibrary,
  updateEntry,
  validateFga,
  decodeLibrary,
  libraryKey,
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
  saving: boolean;
  loading: boolean;
  save(): Promise<void>;
  retry(): Promise<void>;
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
const repository = nativeDocument('library');
const initial = nativeStorage
  ? { library: { version: 1 as const, entries: [] }, error: null, blocked: true }
  : read();
export const useBattleStore = create<BattleState>((set, get) => ({
  ...initial,
  selectedId: initial.library.entries[0]?.id ?? null,
  dirty: false,
  saving: false,
  loading: false,
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
  save: async () => {
    if (get().blocked || get().saving) return;
    const library = get().library;
    set({ saving: true });
    try {
      if (nativeStorage) {
        const source = JSON.stringify(library);
        decodeLibrary(source);
        await repository.save(source);
      } else saveLibrary(localStorage, library);
      set({ dirty: get().library !== library, error: null });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ saving: false });
    }
  },
  retry: async () => {
    if (!get().blocked || get().loading) return;
    set({ loading: true });
    try {
      const state = nativeStorage
        ? {
            library: await repository.load(
              () => localStorage.getItem(libraryKey),
              (source) =>
                source === null ? { version: 1 as const, entries: [] } : decodeLibrary(source),
            ),
            blocked: false,
            error: null,
          }
        : read();
      set({ ...state, selectedId: state.library.entries[0]?.id ?? null });
    } catch (error) {
      set({ blocked: true, error: String(error) });
    } finally {
      set({ loading: false });
    }
  },
}));
if (nativeStorage) void useBattleStore.getState().retry();
