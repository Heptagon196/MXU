export const chaldeaGroups = {
  updates: [
    'autoUpdateData',
    'updateDataBeforeStart',
    'checkDataHash',
    'forceOnline',
    'alertUploadUserData',
  ],
  mirrors: ['api', 'worker', 'data', 'atlasApi', 'atlasAsset'],
} as const;
export type ChaldeaKey = (typeof chaldeaGroups)[keyof typeof chaldeaGroups][number];
export type ChaldeaSettings = Record<ChaldeaKey, boolean>;
const keys = Object.values(chaldeaGroups).flat();
export function validateChaldeaSettings(value: unknown): ChaldeaSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid settings');
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).length !== keys.length ||
    keys.some((key) => typeof data[key] !== 'boolean')
  )
    throw new Error('Invalid settings');
  return data as ChaldeaSettings;
}
let moduleWindow: Window | null = null;
export function bindChaldeaWindow(value: Window | null) {
  moduleWindow = value;
}

export function requestChaldeaSettings(values?: ChaldeaSettings): Promise<ChaldeaSettings> {
  if (values) validateChaldeaSettings(values);
  const id = crypto.randomUUID();
  const message = JSON.stringify({
    type: 'fgaa.chaldea.settings',
    version: 1,
    id,
    operation: values ? 'patch' : 'read',
    ...(values ? { values } : {}),
  });
  return new Promise((resolve, reject) => {
    let sent = false;
    const cleanup = () => {
      clearInterval(retry);
      clearTimeout(timeout);
      window.removeEventListener('message', receive);
    };
    const receive = (event: MessageEvent) => {
      if (
        event.source !== moduleWindow ||
        event.origin !== window.location.origin ||
        typeof event.data !== 'string' ||
        event.data.length > 16384
      )
        return;
      let result;
      try {
        result = JSON.parse(event.data);
      } catch {
        return;
      }
      if (
        result?.type !== 'fgaa.chaldea.settings.result' ||
        result.version !== 1 ||
        result.id !== id
      )
        return;
      cleanup();
      try {
        if (result.error) throw new Error('Chaldea save failed');
        resolve(validateChaldeaSettings(result.values));
      } catch (error) {
        reject(error);
      }
    };
    const send = () => {
      if (!moduleWindow || (values && sent)) return;
      moduleWindow.postMessage(message, window.location.origin);
      sent = true;
    };
    const retry = setInterval(send, 500);
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Chaldea unavailable'));
    }, 30000);
    window.addEventListener('message', receive);
    send();
  });
}
