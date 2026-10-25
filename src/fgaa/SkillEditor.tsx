import { formInputClass } from '@/components/FormControls';
import { formButtonClass } from '@/components/FormControls';
import { CheckboxInput } from '@/components/FormControls';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalPortal, useModalFocusTrap } from '@/components/ui/Modal';
import {
  actionCommand,
  insertAction,
  insertAttack,
  parseCommand,
  planCommand,
  servantTargets,
  type Action,
} from './skillPlan';

const button = formButtonClass;
type SkillChoice = { type: 'servantSkill' | 'masterSkill' | 'commandSpell'; skill: string };

function TargetDialog({
  choice,
  onClose,
  onApply,
}: {
  choice: SkillChoice;
  onClose(): void;
  onApply(action: Action): void;
}) {
  const { t } = useTranslation('fgaa');
  const ref = useRef<HTMLDivElement>(null);
  useModalFocusTrap({ containerRef: ref, onEscape: onClose });
  const [multiple, setMultiple] = useState(false);
  const [targets, setTargets] = useState<string[]>([]);
  const apply = (values: string[]) =>
    onApply(
      choice.type === 'servantSkill'
        ? { ...choice, type: 'servantSkill', targets: values }
        : { ...choice, type: choice.type, target: values[0] ?? null },
    );
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby="fgaa-target-title"
          className="w-full max-w-md rounded-xl border border-border bg-bg-primary p-5 shadow-xl"
        >
          <h2 id="fgaa-target-title" className="mb-4 font-semibold">
            {t('skill.targetTitle', { skill: choice.skill })}
          </h2>
          {choice.type === 'servantSkill' && (
            <label className="mb-3 flex items-center gap-2 text-sm">
              <CheckboxInput
                checked={multiple}
                onChange={(e) => {
                  setMultiple(e.target.checked);
                  setTargets([]);
                }}
              />
              {t('skill.multiTarget')}
            </label>
          )}
          <div className="grid grid-cols-3 gap-2">
            {servantTargets.map((target) => (
              <button
                key={target}
                className={button}
                onClick={() => (multiple ? setTargets([...targets, target]) : apply([target]))}
              >
                {t(`skill.targets.${target}`)}
              </button>
            ))}
          </div>
          {multiple && (
            <div className="my-3 flex flex-wrap gap-1">
              {targets.map((target, i) => (
                <button
                  key={i}
                  className={button}
                  onClick={() => setTargets(targets.filter((_, index) => index !== i))}
                >
                  {i + 1}. {t(`skill.targets.${target}`)} ×
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className={button} onClick={() => apply([])}>
              {t('skill.noTarget')}
            </button>
            <button className={button} onClick={onClose}>
              {t('skill.cancel')}
            </button>
            {multiple && (
              <button className={`${button} bg-accent text-white`} onClick={() => apply(targets)}>
                {t('skill.apply')}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export function SkillEditor({
  command,
  onChanged,
}: {
  command: string;
  onChanged(command: string): void;
}) {
  const { t } = useTranslation('fgaa');
  const parsed = useMemo(() => {
    try {
      return { plan: parseCommand(command), error: false };
    } catch {
      return { plan: null, error: true };
    }
  }, [command]);
  const [waveIndex, setWave] = useState(0);
  const [turnIndex, setTurn] = useState(0);
  const [cursorIndex, setCursor] = useState<number | null>(null);
  const [choice, setChoice] = useState<SkillChoice | null>(null);
  const [nps, setNps] = useState<string[]>([]);
  const [cards, setCards] = useState(0);
  const [starting, setStarting] = useState('1');
  const [reserve, setReserve] = useState('1');
  const [editError, setEditError] = useState(false);
  const commit = (edit: () => string, after: () => void) => {
    try {
      const next = edit();
      parseCommand(next);
      onChanged(next);
      setEditError(false);
      after();
    } catch {
      setEditError(true);
    }
  };
  if (!parsed.plan)
    return (
      <p role="alert" className="text-sm text-text-secondary">
        {t('skill.unsupported')}
      </p>
    );
  const plan = parsed.plan;
  const wave = Math.min(waveIndex, plan.length - 1);
  const turn = Math.min(turnIndex, plan[wave].length - 1);
  const actions = plan[wave][turn];
  const cursor = cursorIndex === null ? actions.length : Math.min(cursorIndex, actions.length);
  const insert = (action: Action) => {
    const next = insertAction(plan, wave, turn, cursor, action);
    onChanged(planCommand(next));
    setEditError(false);
    setCursor(Math.min(cursor + 1, next[wave][turn].length));
    setChoice(null);
  };
  const attack = (nextWave: boolean) => {
    commit(
      () =>
        planCommand(
          insertAttack(
            plan,
            wave,
            turn,
            cursor,
            { type: 'attack', nps, cardsBeforeNP: cards },
            nextWave,
          ),
        ),
      () => {
        setWave(nextWave ? wave + 1 : wave);
        setTurn(nextWave ? 0 : turn + 1);
        setCursor(0);
        setNps([]);
        setCards(0);
      },
    );
  };
  return (
    <section className="space-y-4 rounded-lg border border-border bg-bg-secondary p-4">
      <h2 className="text-sm font-semibold">{t('skill.title')}</h2>
      {editError && (
        <p role="alert" className="text-sm text-text-secondary">
          {t('skill.invalidEdit')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {plan.map((_, i) => (
          <button
            key={i}
            className={`${button} ${wave === i ? 'text-accent bg-bg-active' : ''}`}
            onClick={() => {
              setWave(i);
              setTurn(0);
              setCursor(null);
            }}
          >
            {t('skill.wave', { number: i + 1 })}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {plan[wave].map((_, i) => (
          <button
            key={i}
            className={`${button} ${turn === i ? 'text-accent bg-bg-active' : ''}`}
            onClick={() => {
              setTurn(i);
              setCursor(null);
            }}
          >
            {t('skill.turn', { number: i + 1 })}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-label={t('skill.history')}>
        <button
          className={`${button} ${cursor === 0 ? 'text-accent' : ''}`}
          onClick={() => setCursor(0)}
        >
          {t('skill.start')}
        </button>
        {actions.map((action, i) => (
          <button
            key={i}
            className={`${button} ${cursor === i + 1 ? 'bg-bg-active text-accent' : ''}`}
            aria-pressed={cursor === i + 1}
            onClick={() => setCursor(i + 1)}
          >
            {i + 1}. {actionCommand(action)}
          </button>
        ))}
        <button
          className={button}
          disabled={cursor === 0}
          onClick={() => {
            const next = structuredClone(plan);
            next[wave][turn].splice(cursor - 1, 1);
            commit(
              () => planCommand(next),
              () => setCursor(cursor - 1),
            );
          }}
        >
          {t('skill.delete')}
        </button>
      </div>
      <p className="text-xs text-text-muted">{t('skill.insertHint')}</p>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((servant) => (
          <div key={servant} className="rounded-md border border-border p-2">
            <h3 className="mb-2 text-center text-xs text-text-secondary">
              {t('skill.servant', { number: servant + 1 })}
            </h3>
            <div className="grid grid-cols-3 gap-1">
              {[0, 1, 2].map((skill) => (
                <button
                  key={skill}
                  className={`${button} !px-1 text-accent`}
                  aria-label={t('skill.servantSkill', { servant: servant + 1, skill: skill + 1 })}
                  onClick={() =>
                    setChoice({ type: 'servantSkill', skill: 'abcdefghi'[servant * 3 + skill] })
                  }
                >
                  {skill + 1}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {'jkl'.split('').map((skill, i) => (
          <button
            key={skill}
            className={button}
            onClick={() => setChoice({ type: 'masterSkill', skill })}
          >
            {t('skill.master', { number: i + 1 })}
          </button>
        ))}
        <button className={button} onClick={() => setChoice({ type: 'commandSpell', skill: 'o' })}>
          {t('skill.commandSpell')}
        </button>
        {'123'.split('').map((target) => (
          <button
            key={target}
            className={button}
            onClick={() => insert({ type: 'enemyTarget', target })}
          >
            {t('skill.enemy', { number: target })}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs">
          {t('skill.front')}{' '}
          <select
            className={formInputClass}
            value={starting}
            onChange={(e) => setStarting(e.target.value)}
          >
            {[1, 2, 3].map((i) => (
              <option key={i} value={String(i)}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          {t('skill.reserve')}{' '}
          <select
            className={formInputClass}
            value={reserve}
            onChange={(e) => setReserve(e.target.value)}
          >
            {[1, 2, 3].map((i) => (
              <option key={i} value={String(i)}>
                {i + 3}
              </option>
            ))}
          </select>
        </label>
        <button
          className={button}
          onClick={() => insert({ type: 'orderChange', starting, sub: reserve })}
        >
          {t('skill.swap')}
        </button>
      </div>
      <div className="border-t border-border pt-3 space-y-3">
        <p className="text-xs text-text-secondary">{t('skill.npOrder')}</p>
        <div className="flex flex-wrap gap-2">
          {'456'.split('').map((np, i) => (
            <button
              key={np}
              className={`${button} ${nps.includes(np) ? 'bg-bg-active text-accent' : ''}`}
              aria-pressed={nps.includes(np)}
              onClick={() => setNps(nps.includes(np) ? nps.filter((v) => v !== np) : [...nps, np])}
            >
              {t('skill.np', { number: i + 1 })}
              {nps.includes(np) ? ` · ${nps.indexOf(np) + 1}` : ''}
            </button>
          ))}
        </div>
        <label className="block text-xs">
          {t('skill.beforeNp')}{' '}
          <select
            className={formInputClass}
            value={cards}
            onChange={(e) => setCards(Number(e.target.value))}
          >
            {[0, 1, 2].map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button className={`${button} text-accent`} onClick={() => attack(false)}>
            {t('skill.nextTurn')}
          </button>
          <button className={`${button} text-accent`} onClick={() => attack(true)}>
            {t('skill.nextWave')}
          </button>
        </div>
      </div>
      {choice && <TargetDialog choice={choice} onClose={() => setChoice(null)} onApply={insert} />}
    </section>
  );
}
