import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { SelectInput } from '@/components/ui/SelectInput';
import { formButtonClass } from '@/components/FormControls';
import { formInputClass } from '@/components/FormControls';
import { CheckboxInput } from '@/components/FormControls';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  decodeSpam,
  updateSpam,
  spamModes,
  spamTargets,
  type SpamAction,
  type SpamSlot,
} from './spamPolicy';

const control = formInputClass;
const button = formButtonClass;

function ActionSettings({
  title,
  value,
  skill,
  onChanged,
}: {
  title: string;
  value: SpamAction;
  skill: boolean;
  onChanged(changes: Partial<SpamAction>): void;
}) {
  const { t } = useTranslation('fgaa');
  const [newWave, setNewWave] = useState('4');
  const number = Number(newWave);
  const waves = [...new Set([1, 2, 3, ...value.waves])].sort((a, b) => a - b);
  return (
    <fieldset className="space-y-3 rounded border border-border p-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        {t('spam.mode')}
        <SelectInput
          className="min-w-20"
          aria-label={t('spam.mode')}
          value={value.spam}
          onValueChange={(value) => onChanged({ spam: value })}
        >
          {spamModes.map((mode) => (
            <option key={mode} value={mode}>
              {t(`spam.modes.${mode}`)}
            </option>
          ))}
        </SelectInput>
      </label>
      <fieldset disabled={value.spam === 'None'} className="space-y-3 disabled:opacity-50">
        {skill && (
          <label className="flex flex-wrap items-center gap-2 text-sm">
            {t('spam.target')}
            <SelectInput
              className="min-w-20"
              aria-label={t('spam.target')}
              value={value.target}
              onValueChange={(value) => onChanged({ target: value })}
            >
              {spamTargets.map((target) => (
                <option key={target} value={target}>
                  {t(`spam.targets.${target}`)}
                </option>
              ))}
            </SelectInput>
          </label>
        )}
        <div className="flex flex-wrap gap-3">
          {waves.map((wave) => (
            <label key={wave} className="flex items-center gap-1 text-sm">
              <CheckboxInput
                checked={value.waves.includes(wave)}
                onChange={(event) =>
                  onChanged({
                    waves: event.target.checked
                      ? [...new Set([...value.waves, wave])].sort((a, b) => a - b)
                      : value.waves.filter((value) => value !== wave),
                  })
                }
              />
              {t('skill.wave', { number: wave })}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${control} w-24`}
            type="number"
            min={1}
            max={2147483647}
            step={1}
            aria-label={t('spam.waveNumber')}
            value={newWave}
            onChange={(event) => setNewWave(event.target.value)}
          />
          <button
            className={button}
            disabled={
              !Number.isInteger(number) ||
              number < 1 ||
              number > 2147483647 ||
              value.waves.includes(number)
            }
            onClick={() => onChanged({ waves: [...value.waves, number].sort((a, b) => a - b) })}
          >
            {t('spam.addWave')}
          </button>
        </div>
      </fieldset>
    </fieldset>
  );
}

export function SpamSettings({
  source,
  onChanged,
}: {
  source?: string;
  onChanged(value: string): void;
}) {
  const { t } = useTranslation('fgaa');
  const [slot, setSlot] = useState(0);
  let values: SpamSlot[] | null = null;
  try {
    values = decodeSpam(source);
  } catch {
    /* Preserve unsupported imports until an explicit reset. */
  }
  const current = values;
  return (
    <CollapsibleSection title={t('spam.title')}>
      <div className="mt-4 space-y-4">
        {!current ? (
          <>
            <p role="alert" className="text-sm">
              {t('spam.unsupported')}
            </p>
            <button className={button} onClick={() => onChanged(JSON.stringify(decodeSpam()))}>
              {t('spam.reset')}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-text-muted">{t('spam.hint')}</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <button
                  key={i}
                  className={button}
                  aria-pressed={slot === i}
                  onClick={() => setSlot(i)}
                >
                  {t('cards.slot', { number: i + 1 })}
                </button>
              ))}
            </div>
            {current[slot].skills.map((value, i) => (
              <ActionSettings
                key={`${slot}:${i}`}
                title={t('spam.skill', { number: i + 1 })}
                value={value}
                skill
                onChanged={(changes) => onChanged(updateSpam(current, slot, i, changes))}
              />
            ))}
            <ActionSettings
              key={`${slot}:np`}
              title={t('spam.np')}
              value={current[slot].np}
              skill={false}
              onChanged={(changes) => onChanged(updateSpam(current, slot, null, changes))}
            />
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}
