import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFgaaSettingsStore } from '@/stores/fgaaSettingsStore';
import { SwitchInput, formInputClass } from '@/components/FormControls';
import { SettingsGroup } from '@/components/ui/SettingsGroup';
import { bounds, globalKeys, globalGroups, validateGlobals } from './globalSettings';
export function GlobalSettingsPage() {
  const { t } = useTranslation('fgaa');
  const { values, blocked, saving, loading, save, retry } = useFgaaSettingsStore();
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
      {loading ? (
        <p role="status">{t('globals.loading')}</p>
      ) : blocked ? (
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
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              const next = Object.fromEntries(
                globalKeys.map((key) => [
                  key,
                  typeof values[key] === 'boolean' ? data.has(key) : Number(data.get(key)),
                ]),
              );
              await save(validateGlobals(next));
              setDirty(false);
              setStatus('saved');
            } catch {
              setStatus('error');
            }
          }}
          className="space-y-4"
        >
          {Object.entries(globalGroups).map(([group, keys]) => (
            <SettingsGroup key={group} title={t(`globals.groups.${group}`)} disabled={saving}>
              <div className="grid gap-4 sm:grid-cols-2">
                {keys.map((key) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-4 py-2 text-sm text-text-primary"
                  >
                    <span>{t(`globals.fields.${key}`)}</span>
                    {typeof values[key] === 'boolean' ? (
                      <SwitchInput name={key} defaultChecked={values[key] as boolean} />
                    ) : (
                      <input
                        className={`${formInputClass} w-24`}
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
            </SettingsGroup>
          ))}
          <button
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            type="submit"
            disabled={saving}
          >
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
