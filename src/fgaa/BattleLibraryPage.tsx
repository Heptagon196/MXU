import { primaryButtonClass } from '@/components/FormControls';
import { SelectInput } from '@/components/ui/SelectInput';
import { formButtonClass, formInputClass } from '@/components/FormControls';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Download, Plus, Save, Upload } from 'lucide-react';
import { TextInput } from '@/components/FormControls';
import { exportFga, importFga } from './battleLibrary';
import { useBattleStore } from './battleStore';
import { SkillEditor } from './SkillEditor';
import { enterSkillDisplay } from './skillDisplay';
import { BattleSettings } from './BattleSettings';

const button = formButtonClass;

export function BattleLibraryPage() {
  const { t } = useTranslation('fgaa');
  const state = useBattleStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const displaySession = useRef<Promise<() => Promise<void>> | null>(null);
  const openEditor = () => {
    displaySession.current = enterSkillDisplay();
    setEditing(true);
  };
  const closeEditor = () => {
    setEditing(false);
    const pending = displaySession.current;
    displaySession.current = null;
    void pending?.then((release) => release());
  };
  useEffect(
    () => () => {
      void displaySession.current?.then((release) => release());
    },
    [],
  );
  const [section, setSection] = useState<'skills' | 'settings'>('skills');
  const selected = state.library.entries.find((entry) => entry.id === state.selectedId);
  const data = selected?.data;
  const party = String(data?.autoskill_party ?? '-1');
  const field = (key: string) => String(data?.[key] ?? '');
  const exportSelected = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([exportFga(data)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${
      field('autoskill_name')
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .slice(0, 80) || 'battle'
    }.fga`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="h-full min-h-0 flex flex-col text-text-primary">
      {editing && selected && (
        <SkillEditor
          key={selected.id}
          name={field('autoskill_name')}
          command={field('autoskill_cmd')}
          onChanged={(value) => state.update({ autoskill_cmd: value })}
          onClose={closeEditor}
          onUndo={state.undo}
          onRedo={state.redo}
          canUndo={Boolean(state.undoStacks[selected.id]?.length)}
          canRedo={Boolean(state.redoStacks[selected.id]?.length)}
        />
      )}
      <header className="flex flex-wrap items-center gap-2 border-b border-border p-4">
        <h1 className="mr-auto text-base font-semibold">{t('battle')}</h1>
        <span className="text-xs text-text-muted" role="status">
          {t(
            state.loading
              ? 'globals.loading'
              : state.dirty || state.recoveryDraft
                ? 'unsaved'
                : 'saved',
          )}
        </span>
        <button
          className={button}
          disabled={state.blocked}
          onClick={() => state.add({ autoskill_name: t('newName'), autoskill_cmd: '' })}
        >
          <Plus size={15} />
          {t('new')}
        </button>
        <button
          className={button}
          disabled={state.blocked}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={15} />
          {t('import')}
        </button>
        <button
          className={primaryButtonClass}
          disabled={state.blocked || state.saving || !state.dirty}
          onClick={state.save}
        >
          <Save size={15} />
          {t('save')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".fga,.json"
          className="hidden"
          aria-label={t('import')}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            try {
              if (file.size > 2 * 1024 * 1024) throw new Error('fileTooLarge');
              state.add(importFga(await file.text()));
              setImportError(null);
            } catch (error) {
              setImportError(String(error));
            }
          }}
        />
      </header>
      {(state.error || importError) && (
        <div
          role="alert"
          className="m-4 rounded-md border border-border bg-bg-secondary p-3 text-sm"
        >
          {state.blocked ? t('loadFailed') : state.error && t('saveFailed')}
          {importError && t('importFailed', { message: importError })}
          {state.error && (
            <button
              className={`${button} ml-3`}
              disabled={state.loading || state.saving}
              onClick={state.retry}
            >
              {t('retry')}
            </button>
          )}
        </div>
      )}
      {state.recoveryDraft && (
        <div className="m-4 rounded-xl border border-border bg-bg-secondary p-4 text-sm">
          <p>{t('recoveryHint')}</p>
          <button
            className={`${button} mt-2`}
            disabled={state.blocked || state.loading}
            onClick={state.restoreDraft}
          >
            {t('restoreDraft')}
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
        <aside className="max-h-48 sm:max-h-none sm:w-64 shrink-0 overflow-y-auto border-b sm:border-b-0 sm:border-r border-border p-2">
          {state.library.entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => state.select(entry.id)}
              aria-pressed={entry.id === state.selectedId}
              className={`mb-1 w-full rounded-md px-3 py-3 text-left text-sm ${entry.id === state.selectedId ? 'bg-bg-active text-accent' : 'hover:bg-bg-hover'}`}
            >
              <span className="block truncate">
                {String(entry.data.autoskill_name || t('newName'))}
              </span>
              <span className="mt-1 block truncate font-mono text-[10px] text-text-muted">
                {String(entry.data.autoskill_cmd || t('noCommand'))}
              </span>
            </button>
          ))}
        </aside>
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
          {!data ? (
            <p className="text-sm text-text-muted">{t('empty')}</p>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  disabled={!state.undoStacks[selected!.id]?.length}
                  onClick={state.undo}
                >
                  {t('skill.undo')}
                </button>
                <button
                  className={button}
                  disabled={!state.redoStacks[selected!.id]?.length}
                  onClick={state.redo}
                >
                  {t('skill.redo')}
                </button>
                <button
                  className={button}
                  onClick={() =>
                    state.add({
                      ...data,
                      autoskill_name: `${field('autoskill_name')} (${t('copy')})`,
                    })
                  }
                >
                  <Copy size={15} />
                  {t('copy')}
                </button>
                <button className={button} onClick={exportSelected}>
                  <Download size={15} />
                  {t('export')}
                </button>
              </div>
              <div className="flex gap-2" role="group" aria-label={t('battle')}>
                <button
                  className={button}
                  aria-pressed={section === 'skills'}
                  onClick={() => {
                    setSection('skills');
                    openEditor();
                  }}
                >
                  {t('skill.title')}
                </button>
                <button
                  className={button}
                  aria-pressed={section === 'settings'}
                  onClick={() => setSection('settings')}
                >
                  {t('settings.title')}
                </button>
              </div>
              <label className="block space-y-2 text-xs text-text-secondary">
                {t('name')}
                <TextInput
                  value={field('autoskill_name')}
                  onChange={(value) => state.update({ autoskill_name: value })}
                />
              </label>
              <div hidden={section !== 'settings'} className="space-y-5">
                <label className="block space-y-2 text-xs text-text-secondary">
                  {t('party')}
                  <SelectInput
                    aria-label={t('party')}
                    className="w-full"
                    value={party}
                    onValueChange={(value) => state.update({ autoskill_party: value })}
                  >
                    <option value="-1">{t('currentParty')}</option>
                    {Array.from({ length: 15 }, (_, i) => (
                      <option key={i} value={String(i)}>
                        {t('partyNumber', { number: i + 1 })}
                      </option>
                    ))}
                    {!Array.from({ length: 16 }, (_, i) => String(i - 1)).includes(party) && (
                      <option value={party}>{t('unknownParty', { value: party })}</option>
                    )}
                  </SelectInput>
                </label>
                <label className="block space-y-2 text-xs text-text-secondary">
                  {t('notes')}
                  <textarea
                    className={`${formInputClass} block w-full`}
                    rows={4}
                    value={field('autoskill_notes')}
                    onChange={(event) => state.update({ autoskill_notes: event.target.value })}
                  />
                </label>
                <BattleSettings key={selected!.id} data={data} onChanged={state.update} />
              </div>
              <div hidden={section !== 'skills'}>
                <button className={primaryButtonClass} onClick={openEditor}>
                  {t('skill.open')}
                </button>
                <p className="mt-2 text-sm text-text-secondary">{t('skill.fullscreenHint')}</p>
              </div>
              <section className="rounded-lg border border-border bg-bg-secondary p-4">
                <h2 className="text-sm font-medium">{t('command')}</h2>
                <pre className="my-3 whitespace-pre-wrap break-all text-xs">
                  {field('autoskill_cmd') || t('noCommand')}
                </pre>
              </section>
              <p className="text-xs text-text-muted">{t('localStorage')}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
