import { formButtonClass, primaryButtonClass, CheckboxInput } from '@/components/FormControls';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Undo2, Redo2, Swords, WandSparkles } from 'lucide-react';
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
const largeButton = `${button} min-h-14 sm:min-h-20 min-w-16 text-base`;
type SkillChoice = { type: 'servantSkill' | 'masterSkill' | 'commandSpell'; skill: string };

export function SkillEditor({
  command,
  name,
  onChanged,
  onClose,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  command: string;
  name: string;
  onChanged(command: string): void;
  onClose(): void;
  onUndo(): void;
  onRedo(): void;
  canUndo: boolean;
  canRedo: boolean;
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
  const [stage, setStage] = useState<'main' | 'attack' | 'master' | 'swap'>('main');
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
  const [multiple, setMultiple] = useState(false);
  const [targets, setTargets] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const back = () => {
    if (choice) setChoice(null);
    else if (stage !== 'main') setStage('main');
    else onClose();
  };
  useModalFocusTrap({ containerRef: root, onEscape: back });
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[data-stage-focus]')?.focus();
  }, [stage, choice]);
  const chooseSkill = (next: SkillChoice) => {
    setTargets([]);
    setMultiple(false);
    setChoice(next);
  };
  const plan = parsed.plan ?? [[[]]];
  const wave = Math.min(waveIndex, plan.length - 1);
  const turn = Math.min(turnIndex, plan[wave].length - 1);
  const actions = plan[wave][turn];
  const cursor = cursorIndex === null ? actions.length : Math.min(cursorIndex, actions.length);
  const priorActions = plan
    .slice(0, wave)
    .flat(2)
    .concat(plan[wave].slice(0, turn).flat(), actions.slice(0, cursor));
  const enemyTarget = [...priorActions].reverse().find((action) => action.type === 'enemyTarget');
  const insert = (action: Action) => {
    const next = insertAction(plan, wave, turn, cursor, action);
    onChanged(planCommand(next));
    setEditError(false);
    setCursor(Math.min(cursor + 1, next[wave][turn].length));
    setChoice(null);
    setStage('main');
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
        setStage('main');
      },
    );
  };
  const applyTargets = (values: string[]) => {
    if (!choice) return;
    insert(
      choice.type === 'servantSkill'
        ? { ...choice, type: 'servantSkill', targets: values }
        : { ...choice, type: choice.type, target: values[0] ?? null },
    );
  };
  const stageTitle = choice
    ? t('skill.targetTitle', { skill: choice.skill })
    : t(
        `skill.${stage === 'main' ? 'title' : stage === 'attack' ? 'attack' : stage === 'master' ? 'masterSkills' : 'swap'}`,
      );
  return (
    <ModalPortal>
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={t('skill.title')}
        className="fixed inset-0 z-50 flex min-h-0 flex-col bg-bg-primary text-text-primary"
      >
        <header className="shrink-0 border-b border-border bg-bg-secondary px-4 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2">
            <button className={button} onClick={back} aria-label={t('skill.back')}>
              <ArrowLeft size={16} />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
              {stageTitle}
              <span className="ml-3 text-sm font-normal text-text-muted">{name}</span>
            </h1>
            <span className="text-xs text-text-secondary whitespace-nowrap">
              {t('skill.wave', { number: wave + 1 })} · {t('skill.turn', { number: turn + 1 })}
            </span>
            <button className={primaryButtonClass} onClick={onClose}>
              <Check size={16} />
              {t('skill.done')}
            </button>
          </div>
          <p className="mt-1 text-xs text-text-muted">{t('skill.draftHint')}</p>
        </header>
        {!parsed.plan ? (
          <p role="alert" className="p-6">
            {t('skill.unsupported')}
          </p>
        ) : (
          <>
            {editError && (
              <p role="alert" className="px-4 py-2 text-sm text-error">
                {t('skill.invalidEdit')}
              </p>
            )}
            <main className="flex-1 min-h-0 overflow-auto p-3 sm:p-6 flex flex-col">
              {choice ? (
                <section className="flex flex-1 min-h-0 flex-col gap-4" aria-label={stageTitle}>
                  <div className="flex-1 flex items-center justify-evenly gap-3">
                    {servantTargets.slice(0, 3).map((target) => (
                      <button
                        key={target}
                        data-stage-focus={target === '1' ? true : undefined}
                        className={`${largeButton} w-1/4 max-w-52`}
                        onClick={() =>
                          multiple ? setTargets([...targets, target]) : applyTargets([target])
                        }
                      >
                        {t(`skill.targets.${target}`)}
                      </button>
                    ))}
                  </div>
                  {choice.type === 'servantSkill' && (
                    <label className="flex items-center justify-center gap-2 text-sm">
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
                  {multiple && (
                    <div
                      className="flex flex-wrap justify-center gap-2"
                      aria-label={t('skill.selectedTargets')}
                    >
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
                  <details className="rounded-xl border border-border bg-bg-secondary p-3">
                    <summary className="cursor-pointer text-sm">
                      {t('skill.specialTargets')}
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {servantTargets.slice(3).map((target) => (
                        <button
                          className={button}
                          key={target}
                          onClick={() =>
                            multiple ? setTargets([...targets, target]) : applyTargets([target])
                          }
                        >
                          {t(`skill.targets.${target}`)}
                        </button>
                      ))}
                    </div>
                  </details>
                  <div className="flex shrink-0 justify-center gap-2">
                    <button className={button} onClick={() => applyTargets([])}>
                      {t('skill.noTarget')}
                    </button>
                    <button className={button} onClick={() => setChoice(null)}>
                      {t('skill.cancel')}
                    </button>
                    {multiple && (
                      <button
                        className={primaryButtonClass}
                        disabled={!targets.length}
                        onClick={() => applyTargets(targets)}
                      >
                        {t('skill.apply')}
                      </button>
                    )}
                  </div>
                </section>
              ) : stage === 'attack' ? (
                <section className="flex flex-1 flex-col gap-4" aria-label={t('skill.attack')}>
                  <p className="text-center text-sm text-text-secondary">{t('skill.npOrder')}</p>
                  <div className="flex flex-1 items-center justify-center gap-4">
                    {'456'.split('').map((np, i) => (
                      <button
                        key={np}
                        data-stage-focus={i === 0 ? true : undefined}
                        className={`${largeButton} relative h-28 w-24 sm:h-40 sm:w-32 flex-col`}
                        aria-pressed={nps.includes(np)}
                        onClick={() =>
                          setNps(nps.includes(np) ? nps.filter((v) => v !== np) : [...nps, np])
                        }
                      >
                        {t('skill.np', { number: i + 1 })}
                        {nps.includes(np) && (
                          <span className="rounded-full bg-accent text-white px-2 text-sm">
                            {nps.indexOf(np) + 1}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div role="group" aria-label={t('skill.beforeNp')}>
                      <p className="mb-2 text-sm">{t('skill.beforeNp')}</p>
                      <div className="flex gap-2">
                        {[0, 1, 2].map((n) => (
                          <button
                            className={button}
                            key={n}
                            aria-pressed={cards === n}
                            onClick={() => setCards(n)}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className={primaryButtonClass} onClick={() => attack(false)}>
                        {t('skill.nextTurn')}
                      </button>
                      <button className={primaryButtonClass} onClick={() => attack(true)}>
                        {t('skill.nextWave')}
                      </button>
                    </div>
                  </div>
                </section>
              ) : stage === 'master' ? (
                <section className="flex flex-1 items-center justify-evenly gap-4 flex-wrap">
                  <button data-stage-focus className={largeButton} onClick={() => setStage('swap')}>
                    {t('skill.swap')}
                  </button>
                  <div className="flex gap-3">
                    {'jkl'.split('').map((skill, i) => (
                      <button
                        className={largeButton}
                        key={skill}
                        onClick={() => chooseSkill({ type: 'masterSkill', skill })}
                      >
                        {t('skill.master', { number: i + 1 })}
                      </button>
                    ))}
                  </div>
                </section>
              ) : stage === 'swap' ? (
                <section className="flex flex-1 flex-col justify-around gap-4">
                  {[
                    ['front', starting, setStarting],
                    ['reserve', reserve, setReserve],
                  ].map(([label, value, setValue]) => (
                    <div key={String(label)} role="group" aria-label={t(`skill.${label}`)}>
                      <h2 className="mb-3 text-center text-sm">{t(`skill.${label}`)}</h2>
                      <div className="flex justify-evenly gap-3">
                        {[1, 2, 3].map((n) => (
                          <button
                            key={n}
                            className={`${largeButton} w-1/4 max-w-52`}
                            aria-pressed={value === String(n)}
                            onClick={() => (setValue as (v: string) => void)(String(n))}
                          >
                            {t('skill.servant', { number: label === 'front' ? n : n + 3 })}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    className={`${primaryButtonClass} self-center`}
                    onClick={() => insert({ type: 'orderChange', starting, sub: reserve })}
                  >
                    {t('skill.swap')}
                  </button>
                </section>
              ) : (
                <section className="flex flex-1 flex-col gap-3" aria-label={t('skill.title')}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2" role="group" aria-label={t('skill.enemyTargets')}>
                      {'123'.split('').map((target) => (
                        <button
                          key={target}
                          data-stage-focus={target === '1' ? true : undefined}
                          className={button}
                          aria-pressed={
                            enemyTarget?.type === 'enemyTarget' && enemyTarget.target === target
                          }
                          onClick={() => insert({ type: 'enemyTarget', target })}
                        >
                          {t('skill.enemy', { number: target })}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className={button}
                        onClick={() => chooseSkill({ type: 'commandSpell', skill: 'o' })}
                      >
                        {t('skill.commandSpell')}
                      </button>
                      <button className={button} onClick={() => setStage('master')}>
                        <WandSparkles size={16} />
                        {t('skill.masterSkills')}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 overflow-x-auto shrink-0 pb-1">
                    {plan.map((_, i) => (
                      <button
                        className={`${button} whitespace-nowrap`}
                        key={i}
                        aria-pressed={wave === i}
                        onClick={() => {
                          setWave(i);
                          setTurn(0);
                          setCursor(null);
                        }}
                      >
                        {t('skill.wave', { number: i + 1 })}
                      </button>
                    ))}
                    <span className="border-l border-border" />
                    {plan[wave].map((_, i) => (
                      <button
                        className={`${button} whitespace-nowrap`}
                        key={i}
                        aria-pressed={turn === i}
                        onClick={() => {
                          setTurn(i);
                          setCursor(null);
                        }}
                      >
                        {t('skill.turn', { number: i + 1 })}
                      </button>
                    ))}
                  </div>
                  <div
                    className="flex gap-2 overflow-x-auto shrink-0 pb-1"
                    aria-label={t('skill.history')}
                  >
                    <button
                      className={`${button} shrink-0`}
                      aria-pressed={cursor === 0}
                      onClick={() => setCursor(0)}
                    >
                      {t('skill.start')}
                    </button>
                    {actions.map((action, i) => (
                      <button
                        key={i}
                        className={`${button} shrink-0 font-mono`}
                        aria-pressed={cursor === i + 1}
                        onClick={() => setCursor(i + 1)}
                      >
                        {i + 1}. {actionCommand(action)}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
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
                    <button className={button} disabled={!canUndo} onClick={onUndo}>
                      <Undo2 size={16} />
                      {t('skill.undo')}
                    </button>
                    <button className={button} disabled={!canRedo} onClick={onRedo}>
                      <Redo2 size={16} />
                      {t('skill.redo')}
                    </button>
                    <span className="text-xs text-text-muted">{t('skill.insertHint')}</span>
                  </div>
                  <div className="flex flex-1 min-h-12 items-center justify-end">
                    <button
                      className={`${primaryButtonClass} min-h-16 sm:min-h-24 min-w-24 sm:min-w-28 rounded-full`}
                      onClick={() => {
                        setNps([]);
                        setCards(0);
                        setStage('attack');
                      }}
                    >
                      <Swords size={20} />
                      {t('skill.attack')}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:gap-12 shrink-0">
                    {[0, 1, 2].map((servant) => (
                      <div
                        key={servant}
                        className="rounded-xl border border-border bg-bg-secondary p-2 sm:p-3"
                      >
                        <div className="grid grid-cols-3 gap-1 sm:gap-2">
                          {[0, 1, 2].map((skill) => (
                            <button
                              key={skill}
                              className={`${button} min-h-12 sm:min-h-16 !px-1 font-mono text-lg`}
                              aria-label={t('skill.servantSkill', {
                                servant: servant + 1,
                                skill: skill + 1,
                              })}
                              onClick={() =>
                                chooseSkill({
                                  type: 'servantSkill',
                                  skill: 'abcdefghi'[servant * 3 + skill],
                                })
                              }
                            >
                              {'abcdefghi'[servant * 3 + skill]}
                            </button>
                          ))}
                        </div>
                        <h2 className="mt-2 text-center text-sm">
                          {t('skill.servant', { number: servant + 1 })}
                        </h2>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </main>
            <footer className="shrink-0 border-t border-border px-4 py-2 bg-bg-secondary">
              <pre
                aria-label={t('command')}
                className="overflow-x-auto text-xs text-text-muted whitespace-nowrap"
              >
                {command || t('noCommand')}
              </pre>
            </footer>
          </>
        )}
      </div>
    </ModalPortal>
  );
}
