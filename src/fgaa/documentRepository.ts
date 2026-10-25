type DocumentPort = {
  read(): Promise<string | null>;
  save(expected: string | null, value: string): Promise<void>;
};

/** Keep the exact loaded revision: another window's write must never be lost. */
export function documentRepository(port: DocumentPort) {
  let revision: string | null = null;
  let loaded = false;
  let saving = false;
  return {
    async load<T>(legacy: () => string | null, decode: (value: string | null) => T): Promise<T> {
      loaded = false;
      let source = await port.read();
      if (source === null) {
        source = legacy();
        const result = decode(source);
        if (source !== null) await port.save(null, source);
        revision = source;
        loaded = true;
        return result;
      }
      const result = decode(source);
      revision = source;
      loaded = true;
      return result;
    },
    async save(value: string) {
      if (!loaded || saving) throw new Error('FGA storage is not ready');
      saving = true;
      try {
        await port.save(revision, value);
        revision = value;
      } finally {
        saving = false;
      }
    },
  };
}
