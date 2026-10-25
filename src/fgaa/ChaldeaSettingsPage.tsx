import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SwitchInput } from '@/components/FormControls';
import { chaldeaGroups, requestChaldeaSettings, type ChaldeaSettings } from './chaldeaSettings';

export function ChaldeaSettingsPage({ active }: { active: boolean }) {
  const { t } = useTranslation('fgaa');
  const [values, setValues] = useState<ChaldeaSettings>();
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active || status === 'dirty' || status === 'saving') return;
    let current = true;
    setStatus('loading');
    requestChaldeaSettings()
      .then((next) => {
        if (current) {
          setValues(next);
          setStatus('');
        }
      })
      .catch(() => {
        if (current) setStatus('error');
      });
    return () => {
      current = false;
    };
    // Refresh on entering the category, preserving an unsaved form across categories.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, attempt]);
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (status === 'dirty' || status === 'saving') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [status]);
  return (
    <section className="mx-auto w-full max-w-4xl space-y-5 p-6">
      <div>
        <h1 className="text-lg font-semibold">{t('chaldeaSettings.title')}</h1>
        <p className="mt-2 text-sm text-text-secondary">{t('chaldeaSettings.detail')}</p>
      </div>
      {values && (
        <form
          className="space-y-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setStatus('saving');
            try {
              setValues(await requestChaldeaSettings(values));
              setStatus('saved');
            } catch {
              setStatus('error');
            }
          }}
        >
          {Object.entries(chaldeaGroups).map(([group, keys]) => (
            <fieldset
              key={group}
              disabled={status === 'saving' || status === 'loading'}
              className="rounded-xl border border-border bg-bg-secondary p-4"
            >
              <legend className="px-2 font-medium">{t(`chaldeaSettings.${group}`)}</legend>
              <p className="mb-4 text-sm text-text-secondary">
                {t(`chaldeaSettings.${group}Detail`)}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {keys.map((key) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-4 py-2 text-sm text-text-primary"
                  >
                    {t(`chaldeaSettings.fields.${key}`)}
                    <SwitchInput
                      checked={values[key]}
                      onChange={(event) => {
                        setValues({ ...values, [key]: event.target.checked });
                        setStatus('dirty');
                      }}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button
            disabled={status === 'saving' || status === 'loading'}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed"
            type="submit"
          >
            {t('chaldeaSettings.save')}
          </button>
        </form>
      )}
      <p role="status">{status && t(`chaldeaSettings.${status}`)}</p>
      {status === 'error' && (
        <button className="text-accent" onClick={() => setAttempt((value) => value + 1)}>
          {t('chaldeaRetry')}
        </button>
      )}
    </section>
  );
}
