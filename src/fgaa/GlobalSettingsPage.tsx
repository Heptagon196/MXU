import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFgaaSettingsStore } from '@/stores/fgaaSettingsStore';
import { bounds, globalKeys, validateGlobals } from './globalSettings';
export function GlobalSettingsPage() {
  const { t } = useTranslation('fgaa');
  const { values, blocked, save, retry } = useFgaaSettingsStore();
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty]);
  return (
    <section className="mx-auto max-w-4xl p-6">
      <h1 className="text-lg font-semibold">{t('globals.title')}</h1>
      <p className="my-3 text-sm text-text-secondary">{t('globals.detail')}</p>
      {blocked ? (
        <div role="alert">
          {t('globals.blocked')} <button onClick={retry}>{t('globals.retry')}</button>
        </div>
      ) : (
        <form
          key={JSON.stringify(values)}
          onChange={() => {
            setDirty(true);
            setStatus('');
          }}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              const next = Object.fromEntries(
                globalKeys.map((key) => [
                  key,
                  typeof values[key] === 'boolean' ? data.has(key) : Number(data.get(key)),
                ]),
              );
              save(validateGlobals(next));
              setDirty(false);
              setStatus('saved');
            } catch {
              setStatus('error');
            }
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {globalKeys.map((key) => (
              <label
                key={key}
                className="flex items-center justify-between gap-4 rounded border border-border p-3 text-sm"
              >
                <span>{t(`globals.fields.${key}`)}</span>
                {typeof values[key] === 'boolean' ? (
                  <input type="checkbox" name={key} defaultChecked={values[key] as boolean} />
                ) : (
                  <input
                    className="w-24 rounded border border-border bg-bg-secondary p-2"
                    name={key}
                    type="number"
                    required
                    step="1"
                    min={bounds(key)[0]}
                    max={bounds(key)[1]}
                    defaultValue={values[key] as number}
                  />
                )}
              </label>
            ))}
          </div>
          <button className="rounded bg-accent px-4 py-2 text-white" type="submit">
            {t('globals.save')}
          </button>
          <p role="status">
            {status === 'error'
              ? t('globals.error')
              : dirty
                ? t('unsaved')
                : status && t(`globals.${status}`)}
          </p>
        </form>
      )}
    </section>
  );
}
