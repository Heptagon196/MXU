import type { ProjectInterface, SelectedTask } from '@/types/interface';
import { snapshotGlobals } from '@/stores/fgaaSettingsStore';
import { useBattleStore } from './battleStore';
import { fgaTaskOverride } from './taskInterface';

/** Build at launch from authoritative stores, never the asynchronously rendered option cache. */
export function currentFgaTaskSnapshot(task: SelectedTask, project: ProjectInterface): string {
  const state = useBattleStore.getState();
  if (state.blocked || state.loading) throw new Error('FGA battle library could not be loaded');
  return fgaTaskOverride(task, project, snapshotGlobals(), state.library);
}
