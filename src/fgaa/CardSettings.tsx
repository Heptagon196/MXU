import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FgaConfig } from './battleLibrary';
import {
  defaultCards,
  defaultServants,
  priorityRows,
  serializePriority,
  movePriority,
} from './cardPolicy';

const button =
  'rounded border border-border px-2 py-1 text-xs hover:bg-bg-hover disabled:opacity-40';
const control = 'rounded border border-border bg-bg-secondary p-2 text-sm';

function Priority({
  source,
  servant = false,
  onChanged,
}: {
  source: string;
  servant?: boolean;
  onChanged(value: string): void;
}) {
  const { t } = useTranslation('fgaa');
  const [selected, setSelected] = useState(0);
  let rows: string[][];
  try {
    rows = priorityRows(source, servant);
  } catch {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm">
          {t('cards.unsupported')}
        </p>
        <button
          className={button}
          onClick={() => onChanged(serializePriority([servant ? defaultServants : defaultCards]))}
        >
          {t('cards.reset')}
        </button>
      </div>
    );
  }
  const wave = Math.min(selected, rows.length - 1);
  const name = (token: string) =>
    servant ? t('cards.slot', { number: token }) : t(`cards.types.${token}`);
  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">{t('cards.priorityHint')}</p>
      <div className="flex flex-wrap gap-2">
        {rows.map((_, i) => (
          <button
            key={i}
            className={button}
            aria-pressed={wave === i}
            onClick={() => setSelected(i)}
          >
            {t('skill.wave', { number: i + 1 })}
          </button>
        ))}
        <button
          className={button}
          onClick={() => {
            onChanged(serializePriority([...rows, [...rows[rows.length - 1]]]));
            setSelected(rows.length);
          }}
        >
          {t('cards.addWave')}
        </button>
        <button
          className={button}
          disabled={rows.length === 1}
          onClick={() => {
            onChanged(serializePriority(rows.filter((_, i) => i !== wave)));
            setSelected(Math.max(0, wave - 1));
          }}
        >
          {t('cards.removeWave')}
        </button>
      </div>
      <ol className="space-y-1">
        {rows[wave].map((token, i) => (
          <li key={i} className="flex items-center gap-2 rounded bg-bg-secondary px-2 py-1 text-sm">
            <span className="text-text-muted">{i + 1}.</span>
            <span className="mr-auto">{name(token)}</span>
            <button
              className={button}
              aria-label={t('cards.up', { name: name(token) })}
              disabled={i === 0}
              onClick={() => onChanged(serializePriority(movePriority(rows, wave, i, i - 1)))}
            >
              ↑
            </button>
            <button
              className={button}
              aria-label={t('cards.down', { name: name(token) })}
              disabled={i === rows[wave].length - 1}
              onClick={() => onChanged(serializePriority(movePriority(rows, wave, i, i + 1)))}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function WaveFlags({
  source,
  fallback,
  options,
  onChanged,
}: {
  source: string;
  fallback: string;
  options: string[];
  onChanged(value: string): void;
}) {
  const { t } = useTranslation('fgaa');
  const rows = source ? source.split(',') : [fallback];
  return (
    <div className="space-y-2">
      {rows.map((value, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            {t('skill.wave', { number: i + 1 })}
            <select
              className={control}
              aria-label={t('skill.wave', { number: i + 1 })}
              value={value}
              onChange={(event) =>
                onChanged(
                  rows.map((old, index) => (index === i ? event.target.value : old)).join(','),
                )
              }
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {t(`cards.options.${option}`)}
                </option>
              ))}
              {!options.includes(value) && <option value={value}>{value}</option>}
            </select>
          </label>
          <button
            className={button}
            disabled={rows.length === 1}
            onClick={() => onChanged(rows.filter((_, index) => index !== i).join(','))}
          >
            {t('cards.removeWave')}
          </button>
        </div>
      ))}
      <button
        className={button}
        onClick={() => onChanged([...rows, rows[rows.length - 1]].join(','))}
      >
        {t('cards.addWave')}
      </button>
    </div>
  );
}

export function CardSettings({
  data,
  onChanged,
}: {
  data: FgaConfig;
  onChanged(changes: FgaConfig): void;
}) {
  const { t } = useTranslation('fgaa');
  const shuffle = String(data.shuffle_cards ?? 'None');
  return (
    <details className="rounded-lg border border-border p-4">
      <summary className="cursor-pointer text-sm font-semibold">{t('cards.title')}</summary>
      <div className="mt-4 space-y-5">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t('cards.priority')}</legend>
          <Priority
            source={String(data.card_priority ?? '')}
            onChanged={(value) => onChanged({ card_priority: value })}
          />
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.use_servant_priority === true}
            onChange={(event) => onChanged({ use_servant_priority: event.target.checked })}
          />
          {t('cards.useServants')}
        </label>
        <fieldset
          disabled={data.use_servant_priority !== true}
          className="space-y-2 disabled:opacity-50"
        >
          <legend className="mb-2 text-sm font-medium">{t('cards.servants')}</legend>
          <Priority
            servant
            source={String(data.servant_priority ?? '')}
            onChanged={(value) => onChanged({ servant_priority: value })}
          />
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t('cards.brave')}</legend>
          <WaveFlags
            source={String(data.auto_skill_brave_chains ?? '')}
            fallback="None"
            options={['None', 'WithNP', 'Avoid']}
            onChanged={(value) => onChanged({ auto_skill_brave_chains: value })}
          />
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t('cards.rearrange')}</legend>
          <WaveFlags
            source={String(data.auto_skill_rearrange_cards ?? '')}
            fallback="F"
            options={['F', 'T']}
            onChanged={(value) => onChanged({ auto_skill_rearrange_cards: value })}
          />
        </fieldset>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          {t('cards.shuffle')}
          <select
            className={control}
            aria-label={t('cards.shuffle')}
            value={shuffle}
            onChange={(event) => onChanged({ shuffle_cards: event.target.value })}
          >
            {['None', 'NoEffective', 'NoNPMatching'].map((value) => (
              <option key={value} value={value}>
                {t(`cards.options.${value}`)}
              </option>
            ))}
            {!['None', 'NoEffective', 'NoNPMatching'].includes(shuffle) && (
              <option value={shuffle}>{shuffle}</option>
            )}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          {t('cards.shuffleWave')}
          <select
            className={control}
            aria-label={t('cards.shuffleWave')}
            disabled={shuffle === 'None'}
            value={String(data.shuffle_cards_wave ?? 3)}
            onChange={(event) => onChanged({ shuffle_cards_wave: Number(event.target.value) })}
          >
            {[1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            {![1, 2, 3].includes(Number(data.shuffle_cards_wave ?? 3)) && (
              <option value={String(data.shuffle_cards_wave)}>
                {String(data.shuffle_cards_wave)}
              </option>
            )}
          </select>
        </label>
      </div>
    </details>
  );
}
