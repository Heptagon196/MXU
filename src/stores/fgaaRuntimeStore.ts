import { create } from 'zustand';
import { applyRuntimeEvent, parseRuntimeEvent, type RuntimeRun } from '../fgaa/runtimeEvents';

interface State {
  instances: Record<string, RuntimeRun[]>;
  consume(instanceId: string, batch: string): string;
  outputClosed(instanceId: string, payload: string): void;
}
export const useFgaaRuntimeStore = create<State>((set) => ({
  instances: {},
  outputClosed(instanceId, payload) {
    if (payload.length > 1024) return;
    let value: { runId?: unknown; nativeTaskId?: unknown } | null;
    try {
      value = JSON.parse(payload);
    } catch {
      return;
    }
    if (!value || typeof value.runId !== 'string' || !Number.isSafeInteger(value.nativeTaskId))
      return;
    const { runId, nativeTaskId } = value;
    set((state) => ({
      instances: {
        ...state.instances,
        [instanceId]: (state.instances[instanceId] ?? []).map((run) =>
          run.runId === runId && run.nativeTaskId === nativeTaskId && run.status === 'running'
            ? { ...run, status: 'failed', reason: 'agent_output_closed', incomplete: true }
            : run,
        ),
      },
    }));
  },
  consume(instanceId, batch) {
    const ordinary: string[] = [];
    const events = batch.split(/\r?\n/).flatMap((line) => {
      const event = parseRuntimeEvent(line);
      if (event) return [event];
      ordinary.push(line);
      return [];
    });
    if (events.length)
      set((state) => ({
        instances: {
          ...state.instances,
          [instanceId]: events.reduce(applyRuntimeEvent, state.instances[instanceId] ?? []),
        },
      }));
    return ordinary.join('\n').trim();
  },
}));
