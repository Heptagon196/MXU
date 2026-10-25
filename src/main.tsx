import { invoke } from '@tauri-apps/api/core';
import { waitForNativeHost } from './fgaa/nativeStartup';
import './index.css';

async function start() {
  const root = document.getElementById('root')!;
  try {
    if ('__FGAA_ANDROID__' in window) {
      root.textContent = '正在启动 FGAA…';
      await waitForNativeHost(() => invoke<string>('get_data_dir'));
    }
    // Import stores and logging only after mobile paths and IPC are ready.
    await import('./mountApp');
  } catch (error) {
    root.replaceChildren();
    const message = document.createElement('p');
    message.textContent = error instanceof Error ? error.message : String(error);
    const retry = document.createElement('button');
    retry.textContent = '重新启动';
    retry.onclick = () => location.reload();
    root.append(message, retry);
  }
}
void start();
