import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ListChecks, Swords, Settings } from 'lucide-react';
import './i18n';
import { BattleLibraryPage } from './BattleLibraryPage';
import { GlobalSettingsPage } from './GlobalSettingsPage';
import { useBattleStore } from './battleStore';
import { useAppStore } from '@/stores/appStore';
import { useFgaaSettingsStore } from '@/stores/fgaaSettingsStore';
import { withBattleChoices, taskOptionKey, refillResources } from './taskInterface';

const pages = [
  { id: 'automation', icon: ListChecks },
  { id: 'battle', icon: Swords },
  { id: 'chaldea', icon: BookOpen },
  { id: 'settings', icon: Settings },
] as const;
type Page = (typeof pages)[number]['id'];

/** Feature pages are independent of MXU's original per-instance TabBar. */
export function ProductShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation('fgaa');
  const [page, setPage] = useState<Page>('automation');
  const dirty = useBattleStore((state) => state.dirty);
  const library = useBattleStore((state) => state.library);
  const hideSQ = useFgaaSettingsStore((state) => state.values.hide_sq_in_ap_resources);
  const pi = useAppStore((state) => state.projectInterface);
  useEffect(() => {
    if (!pi || pi.name !== 'FGAA') return;
    const next = withBattleChoices(pi, library);
    const key = taskOptionKey('Battle', 'refill_resource');
    const refill = next.option?.[key];
    if (refill && (refill.type === 'select' || refill.type === undefined)) {
      next.option = {
        ...next.option,
        [key]: {
          ...refill,
          cases: refillResources
            .filter((name) => !hideSQ || name !== 'SQ')
            .map((name) => ({ name, label: `$tasks.refill.${name}` })),
        },
      };
    }
    if (JSON.stringify(next.option) !== JSON.stringify(pi.option))
      useAppStore.getState().setProjectInterface(next);
  }, [pi, library, hideSQ]);
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
    <div className="h-full flex flex-col bg-bg-primary text-text-primary">
      <nav
        role="tablist"
        aria-label={t('navigation')}
        className="flex shrink-0 overflow-x-auto gap-1 border-b border-border bg-bg-secondary px-3 py-2"
      >
        {pages.map(({ id, icon: Icon }, index) => (
          <button
            key={id}
            id={`fgaa-tab-${id}`}
            role="tab"
            aria-selected={page === id}
            aria-controls={`fgaa-page-${id}`}
            tabIndex={page === id ? 0 : -1}
            onClick={() => setPage(id)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % pages.length
                  : event.key === 'ArrowLeft'
                    ? (index + pages.length - 1) % pages.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? pages.length - 1
                        : null;
              if (next === null) return;
              event.preventDefault();
              setPage(pages[next].id);
              document.getElementById(`fgaa-tab-${pages[next].id}`)?.focus();
            }}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors ${page === id ? 'bg-bg-active text-accent' : 'text-text-secondary hover:bg-bg-hover'}`}
          >
            <Icon size={16} />
            {t(id === 'settings' ? 'globalSettingsTab' : id)}
            {id === 'battle' && dirty && <span aria-label={t('unsaved')}>•</span>}
          </button>
        ))}
      </nav>
      <div
        id="fgaa-page-settings"
        role="tabpanel"
        aria-labelledby="fgaa-tab-settings"
        hidden={page !== 'settings'}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        <GlobalSettingsPage />
      </div>
      {/* Keep the original app mounted: running tasks and instance state survive page changes. */}
      <div
        id="fgaa-page-automation"
        role="tabpanel"
        aria-labelledby="fgaa-tab-automation"
        hidden={page !== 'automation'}
        className="flex-1 min-h-0"
      >
        {children}
      </div>
      <div
        id="fgaa-page-battle"
        role="tabpanel"
        aria-labelledby="fgaa-tab-battle"
        hidden={page !== 'battle'}
        className="flex-1 min-h-0"
      >
        <BattleLibraryPage />
      </div>
      <div
        id="fgaa-page-chaldea"
        role="tabpanel"
        aria-labelledby="fgaa-tab-chaldea"
        hidden={page !== 'chaldea'}
        className="flex-1 min-h-0 overflow-y-auto p-6"
      >
        <h1 className="text-lg font-semibold">{t('chaldeaPending')}</h1>
        <p className="mt-3 text-sm text-text-secondary">{t('chaldeaDetail')}</p>
      </div>
    </div>
  );
}
