import { create } from 'zustand';
import { applyRuntimeEvent, parseRuntimeEvent, type RuntimeRun } from '../fgaa/runtimeEvents';

interface State {
  instances: Record<string, RuntimeRun[]>;
  consume(instanceId: string, batch: string): string;
}
export const useFgaaRuntimeStore = create<State>((set) => ({
  instances: {},
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
