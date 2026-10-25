import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import catalog from '@/i18n/locales/fgaa-materials.json';

export function MaterialPicker({
  selected,
  onChanged,
}: {
  selected: string[];
  onChanged(values: string[]): void;
}) {
  const { t, i18n } = useTranslation('fgaa');
  const [query, setQuery] = useState('');
  const chinese = i18n.language.startsWith('zh');
  const entries: Record<string, { en: string; zh: string }> = catalog;
  const label = (id: string) => entries[id]?.[chinese ? 'zh' : 'en'] ?? id;
  const remove = (id: string) => onChanged(selected.filter((value) => value !== id));
  const search = query.trim().toLocaleLowerCase();
  const visible = Object.entries(entries).filter(([id, labels]) =>
    `${id} ${labels.en} ${labels.zh}`.toLocaleLowerCase().includes(search),
  );
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-semibold">{t('materials.title')}</legend>
      <p className="text-xs text-text-muted">{t('materials.hint')}</p>
      <div className="flex flex-wrap gap-2" aria-label={t('materials.selected')}>
        {selected.map((id, index) => (
          <button
            key={`${id}:${index}`}
            type="button"
            className="rounded border border-border bg-bg-active px-2 py-1 text-xs"
            aria-label={t('materials.remove', { name: label(id) })}
            onClick={() => remove(id)}
          >
            {label(id)} ×
          </button>
        ))}
        {!selected.length && (
          <span className="text-xs text-text-muted">{t('materials.empty')}</span>
        )}
      </div>
      <input
        type="search"
        aria-label={t('materials.search')}
        placeholder={t('materials.search')}
        className="w-full rounded border border-border bg-bg-secondary p-2 text-sm"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {visible.map(([id]) => (
          <label key={id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(id)}
              onChange={(event) =>
                event.target.checked ? onChanged([...selected, id]) : remove(id)
              }
            />
            {label(id)}
          </label>
        ))}
        {!visible.length && <p className="text-xs text-text-muted">{t('materials.noResults')}</p>}
      </div>
    </fieldset>
  );
}
