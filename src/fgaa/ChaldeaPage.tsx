import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bindChaldeaWindow } from './chaldeaSettings';

/** Load the bundled Chaldea app once; switching product tabs preserves its state. */
export function ChaldeaPage({ active }: { active: boolean }) {
  const { t } = useTranslation('fgaa');
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'missing'>('idle');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active || state === 'ready') return;
    const controller = new AbortController();
    setState('loading');
    fetch('/chaldea/index.html', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || !(await response.text()).includes('data-fgaa="true"'))
          throw new Error('Chaldea module unavailable');
        setState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('missing');
      });
    return () => controller.abort();
    // The first successful probe owns the iframe for this application session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, attempt]);
  if (state === 'ready')
    return (
      <iframe
        title={t('chaldea')}
        src="/chaldea/index.html"
        className="h-full w-full border-0"
        onLoad={(event) => bindChaldeaWindow(event.currentTarget.contentWindow)}
      />
    );
  return (
    <div className="p-6 text-sm text-text-secondary" role="status">
      <span>{t(state === 'missing' ? 'chaldeaModuleMissing' : 'chaldeaLoading')}</span>
      {state === 'missing' && (
        <button className="ml-3 text-accent" onClick={() => setAttempt((value) => value + 1)}>
          {t('chaldeaRetry')}
        </button>
      )}
    </div>
  );
}
