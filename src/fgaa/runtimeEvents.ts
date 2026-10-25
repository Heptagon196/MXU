export type RunStatus = 'running' | 'completed' | 'stopped' | 'attention' | 'failed';
export interface RuntimeEvent {
  protocol: 1;
  event: 'started' | 'finished' | 'notify' | 'log' | 'highlight';
  runId: string;
  nativeTaskId: number;
  sequence: number;
  time: string;
  payload: Record<string, unknown>;
}
export interface RuntimeRun {
  runId: string;
  taskId: string | null;
  mode: string | null;
  nativeTaskId: number;
  sequence: number;
  status: RunStatus;
  reason?: string;
  details?: Record<string, unknown>;
  messages: RuntimeEvent[];
  incomplete: boolean;
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Agent output batches may contain multiple JSON records mixed with ordinary stderr. */
export function parseRuntimeEvent(line: string): RuntimeEvent | null {
  if (line.length > 131072) return null;
  try {
    const value: unknown = JSON.parse(line);
    if (
      !object(value) ||
      value.protocol !== 1 ||
      !['started', 'finished', 'notify', 'log', 'highlight'].includes(String(value.event)) ||
      typeof value.runId !== 'string' ||
      !/^[\da-f-]{36}$/i.test(value.runId) ||
      !Number.isSafeInteger(value.nativeTaskId) ||
      !Number.isSafeInteger(value.sequence) ||
      (value.sequence as number) < 1 ||
      typeof value.time !== 'string' ||
      !Number.isFinite(Date.parse(value.time)) ||
      !object(value.payload)
    )
      return null;
    if (
      value.event === 'started' &&
      (value.sequence !== 1 ||
        ![value.payload.taskId, value.payload.mode].every(
          (v) => v === null || (typeof v === 'string' && v.length <= 80),
        ))
    )
      return null;
    if (
      value.event === 'finished' &&
      (!['completed', 'stopped', 'attention', 'failed'].includes(String(value.payload.status)) ||
        typeof value.payload.reason !== 'string' ||
        value.payload.reason.length > 128 ||
        !object(value.payload.details))
    )
      return null;
    return value as unknown as RuntimeEvent;
  } catch {
    return null;
  }
}

export function applyRuntimeEvent(runs: RuntimeRun[], event: RuntimeEvent): RuntimeRun[] {
  const index = runs.findIndex((run) => run.runId === event.runId);
  if (event.event === 'started') {
    if (index >= 0) return runs;
    return [
      ...runs.slice(-19),
      {
        runId: event.runId,
        taskId: event.payload.taskId as string | null,
        mode: event.payload.mode as string | null,
        nativeTaskId: event.nativeTaskId,
        sequence: 1,
        status: 'running',
        messages: [],
        incomplete: false,
      },
    ];
  }
  if (index < 0) return runs;
  const previous = runs[index];
  if (
    previous.status !== 'running' ||
    event.sequence <= previous.sequence ||
    event.nativeTaskId !== previous.nativeTaskId
  )
    return runs;
  const next: RuntimeRun = {
    ...previous,
    sequence: event.sequence,
    incomplete: previous.incomplete || event.sequence !== previous.sequence + 1,
  };
  if (event.event === 'finished') {
    next.status = event.payload.status as RunStatus;
    next.reason = event.payload.reason as string;
    next.details = event.payload.details as Record<string, unknown>;
  } else if (event.event !== 'highlight') {
    next.messages = [...previous.messages.slice(-99), event];
  }
  return runs.map((run, i) => (i === index ? next : run));
}
