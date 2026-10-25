import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { GlobalSettingsPage } from './GlobalSettingsPage';
import { ChaldeaSettingsPage } from './ChaldeaSettingsPage';
const FrameworkSettings = lazy(async () => ({
  default: (await import('@/components/SettingsPage')).SettingsPage,
}));
export type SettingsSection = 'fga' | 'framework' | 'chaldea';
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
    <div className="h-full min-h-0 flex flex-col md:flex-row">
      <nav
        aria-label={t('globals.sections')}
        className="flex shrink-0 gap-2 border-b border-border p-3 md:w-48 md:flex-col md:border-b-0 md:border-r"
      >
        {(['framework', 'fga', 'chaldea'] as const).map((id) => (
          <button
            key={id}
            aria-pressed={section === id}
            onClick={() => onSection(id)}
            className={`rounded px-4 py-3 text-left text-sm ${section === id ? 'bg-bg-active font-medium text-accent' : 'text-text-secondary hover:bg-bg-hover'}`}
          >
            {t(`globals.${id}`)}
          </button>
        ))}
      </nav>
      <div hidden={section !== 'chaldea'} className="flex-1 min-w-0 min-h-0 overflow-y-auto">
        <ChaldeaSettingsPage active={section === 'chaldea'} />
      </div>
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
