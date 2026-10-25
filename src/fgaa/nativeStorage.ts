import { invoke, isTauri } from '@tauri-apps/api/core';
import { documentRepository } from './documentRepository';

export const nativeStorage = isTauri();
export function nativeDocument(key: 'library' | 'globals') {
  return documentRepository({
    read: () => invoke<string | null>('fgaa_read_document', { key }),
    save: (expected, value) => invoke<void>('fgaa_save_document', { key, expected, value }),
  });
}
