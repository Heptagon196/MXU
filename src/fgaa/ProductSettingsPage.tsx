import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { GlobalSettingsPage } from './GlobalSettingsPage';
const FrameworkSettings = lazy(async () => ({
  default: (await import('@/components/SettingsPage')).SettingsPage,
}));
export type SettingsSection = 'fga' | 'framework';
export function ProductSettingsPage({
  section,
  onSection,
  onClose,
}: {
  section: SettingsSection;
  onSection(section: SettingsSection): void;
  onClose(): void;
}) {
  const { t } = useTranslation('fgaa');
  return (
    <div className="h-full min-h-0 flex flex-col">
      <nav
        aria-label={t('globals.sections')}
        className="flex shrink-0 gap-2 border-b border-border px-6 py-3"
      >
        {(['framework', 'fga'] as const).map((id) => (
          <button
            key={id}
            aria-pressed={section === id}
            onClick={() => onSection(id)}
            className={`rounded px-4 py-2 text-sm ${section === id ? 'bg-bg-active text-accent' : 'hover:bg-bg-hover'}`}
          >
            {t(`globals.${id}`)}
          </button>
        ))}
      </nav>
      <div hidden={section !== 'fga'} className="flex-1 min-h-0 overflow-y-auto">
        <GlobalSettingsPage />
      </div>
      {section === 'framework' && (
        <Suspense fallback={<p role="status">{t('globals.loading')}</p>}>
          <FrameworkSettings onClose={onClose} />
        </Suspense>
      )}
    </div>
  );
}
