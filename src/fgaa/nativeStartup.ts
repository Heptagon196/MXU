/** Only probe a read-only command: a lost startup callback is safe to retry. */
export async function waitForNativeHost(
  probe: () => Promise<string>,
  attemptMs = 500,
  attempts = 20,
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const path = await Promise.race([
        probe(),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), attemptMs);
        }),
      ]);
      if (path) return;
    } catch {
      // Setup may not yet have published the application directories.
    } finally {
      clearTimeout(timer);
    }
    const remaining = attemptMs - (Date.now() - started);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  throw new Error('原生服务启动超时，请重试。');
}
