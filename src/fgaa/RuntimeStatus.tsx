import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/appStore';
import { useFgaaRuntimeStore } from '@/stores/fgaaRuntimeStore';

export function RuntimeStatus() {
  const { t } = useTranslation('fgaa');
  const instanceId = useAppStore((state) => state.activeInstanceId);
  const run = useFgaaRuntimeStore((state) => {
    const runs = instanceId ? state.instances[instanceId] : undefined;
    return runs?.[runs.length - 1];
  });
  if (!run) return null;
  const battle = run.details?.battle as Record<string, unknown> | undefined;
  return (
    <section
      aria-label={t('runtime.title')}
      className="shrink-0 border-b border-border bg-bg-secondary px-4 py-2 text-sm"
    >
      <div role="status" className="flex flex-wrap items-center gap-3">
        <strong>{t(`runtime.states.${run.status}`)}</strong>
        <span>{run.taskId ?? t('runtime.unknownTask')}</span>
        {run.mode && <span>{t(`tasks.modes.${run.mode}`, { defaultValue: run.mode })}</span>}
        {run.reason && (
          <span>
            {t(`runtime.reasons.${run.reason}`, { defaultValue: t('runtime.otherReason') })}
          </span>
        )}
        {battle && typeof battle.runs === 'number' && (
          <span>{t('runtime.runs', { count: battle.runs })}</span>
        )}
        {run.incomplete && <span className="text-warning">{t('runtime.incomplete')}</span>}
      </div>
      {run.messages.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-text-secondary">
            {t('runtime.messages', { count: run.messages.length })}
          </summary>
          <ol className="max-h-36 overflow-auto text-xs text-text-secondary">
            {run.messages.map((event) => (
              <li key={event.sequence} className="py-1">
                {t(`runtime.messageCodes.${String(event.payload.code)}`, {
                  ...Object.fromEntries(
                    Object.entries(event.payload)
                      .filter(([key]) =>
                        [
                          'minutes',
                          'durationMs',
                          'runs',
                          'refills',
                          'ceDrops',
                          'cards',
                          'nps',
                          'party',
                          'servant',
                          'slot',
                        ].includes(key),
                      )
                      .map(([key, value]) => [
                        key,
                        Array.isArray(value) ? value.join(', ') : (value ?? '—'),
                      ]),
                  ),
                  defaultValue: t('runtime.unknownMessage'),
                })}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
