import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FgaConfig } from './battleLibrary';
import { MaterialPicker } from './MaterialPicker';
import { CardSettings } from './CardSettings';
import { SpamSettings } from './SpamSettings';

const control =
  'w-full rounded-md border border-border bg-bg-secondary p-2 text-sm text-text-primary';
const supportFlags = [
  'support_friends_only',
  'support_pref_ce_mlb',
  'support_max_ascended',
  'support_skill_max_1',
  'support_skill_max_2',
  'support_skill_max_3',
  'support_grand_servant',
  'support_require_both_normal_and_reward_match',
];

function ReferenceList({
  field,
  values,
  onApply,
}: {
  field: string;
  values: string[];
  onApply(values: string[]): void;
}) {
  const { t } = useTranslation('fgaa');
  const [draft, setDraft] = useState(values.join('\n'));
  return (
    <div className="space-y-2">
      <label className="block space-y-2 text-sm">
        <span>{t(`settings.${field}`)}</span>
        <textarea
          aria-label={t(`settings.${field}`)}
          className={control}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <p className="text-xs text-text-muted">{t('settings.referenceHint')}</p>
      <button
        className="rounded-md border border-border px-3 py-2 text-xs hover:bg-bg-hover"
        onClick={() =>
          onApply([
            ...new Set(
              draft
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean),
            ),
          ])
        }
      >
        {t('settings.applyReferences')}
      </button>
    </div>
  );
}

export function BattleSettings({
  data,
  onChanged,
}: {
  data: FgaConfig;
  onChanged(changes: FgaConfig): void;
}) {
  const { t } = useTranslation('fgaa');
  const choice = (field: string, fallback: string, options: string[], disabled = false) => {
    const value = String(data[field] ?? fallback);
    return (
      <label className="block space-y-2 text-sm" key={field}>
        <span>{t(`settings.${field}`)}</span>
        <select
          aria-label={t(`settings.${field}`)}
          className={control}
          value={value}
          disabled={disabled}
          onChange={(event) => onChanged({ [field]: event.target.value })}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {t(`settings.options.${option || 'Any'}`, { defaultValue: option })}
            </option>
          ))}
          {!options.includes(value) && (
            <option value={value}>{t('unknownParty', { value })}</option>
          )}
        </select>
      </label>
    );
  };
  const toggle = (field: string, disabled = false) => (
    <label key={field} className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={data[field] === true}
        disabled={disabled}
        onChange={(event) => onChanged({ [field]: event.target.checked })}
      />
      {t(`settings.${field}`)}
    </label>
  );
  const mode = String(data.support_mode ?? 'Preferred');
  const preferred = mode === 'Preferred';
  return (
    <div className="space-y-4">
      <CardSettings data={data} onChanged={onChanged} />
      <SpamSettings
        source={data.spam_x as string | undefined}
        onChanged={(value) => onChanged({ spam_x: value })}
      />
      <details open className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-semibold">{t('settings.battle')}</summary>
        <div className="mt-4 space-y-4">
          {choice('battle_config_server', '', [
            '',
            'En',
            'En BFGO',
            'Jp',
            'Jp BFGO',
            'Cn',
            'Tw',
            'Kr',
          ])}
          {toggle('auto_choose_target')}
          <MaterialPicker
            selected={(data.battle_config_mat ?? []) as string[]}
            onChanged={(values) => onChanged({ battle_config_mat: values })}
          />
          {toggle('add_raid_delay')}
          {choice(
            'raid_delay_seconds',
            '3',
            Array.from({ length: 10 }, (_, index) => String(index + 1)),
            data.add_raid_delay !== true,
          )}
        </div>
      </details>
      <details open className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-semibold">{t('settings.support')}</summary>
        <div className="mt-4 space-y-4">
          {choice('autoskill_support_class', 'None', [
            'None',
            'All',
            'Saber',
            'Archer',
            'Lancer',
            'Rider',
            'Caster',
            'Assassin',
            'Berserker',
            'Extra',
            'Mix',
          ])}
          {choice('support_mode', 'Preferred', ['First', 'Manual', 'Preferred'])}
          {toggle(
            'also_check_all',
            mode === 'Manual' ||
              ['None', 'All', 'Mix'].includes(String(data.autoskill_support_class ?? 'None')),
          )}
          <fieldset disabled={!preferred} className="space-y-4 disabled:opacity-50">
            {choice('support_fallback', 'Manual', ['First', 'Manual'])}
            {['support_pref_servant_list', 'support_pref_ce_list', 'support_friend_names_list'].map(
              (field) => (
                <ReferenceList
                  key={`${field}:${JSON.stringify(data[field])}`}
                  field={field}
                  values={(data[field] ?? []) as string[]}
                  onApply={(values) => onChanged({ [field]: values })}
                />
              ),
            )}
            {supportFlags.map((field) => toggle(field))}
            {choice('support_bond_ce_effect', 'Ignore', ['Ignore', 'Default', 'NP'])}
          </fieldset>
        </div>
      </details>
    </div>
  );
}
