import './skillEditor.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Undo2, Redo2, Trash2, RotateCcw, FastForward } from 'lucide-react';
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

const button = 'fga-button';
const primaryButtonClass = button;
const largeButton = 'fga-button fga-large';
const servantColors = ['#c62828', '#0277bd', '#f57f17'];
const historyColor = (action: Action) =>
  action.type === 'servantSkill'
    ? servantColors[Math.floor('abcdefghi'.indexOf(action.skill) / 3)]
    : action.type === 'masterSkill'
      ? '#006064'
      : action.type === 'enemyTarget'
        ? '#2e7d32'
        : action.type === 'commandSpell'
          ? '#a03243'
          : '#616161';
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
  const [resetting, setResetting] = useState(false);
  const [special, setSpecial] = useState<'two' | 'three' | 'other' | null>(null);
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
    if (resetting) setResetting(false);
    else if (special) setSpecial(null);
    else if (choice) setChoice(null);
    else if (stage !== 'main') setStage('main');
    else onClose();
  };
  useModalFocusTrap({ containerRef: root, onEscape: back });
  useEffect(() => {
    root.current
      ?.querySelector<HTMLElement>(resetting ? '[role=alertdialog] button' : '[data-stage-focus]')
      ?.focus();
  }, [stage, choice, resetting]);
  const chooseSkill = (next: SkillChoice) => {
    setTargets([]);
    setSpecial(null);
    setMultiple(false);
    setChoice(next);
  };
  const plan = parsed.plan ?? [[[]]];
  const wave = Math.min(waveIndex, plan.length - 1);
  const turn = Math.min(turnIndex, plan[wave].length - 1);
  const actions = plan[wave][turn];
  const cursor = cursorIndex === null ? actions.length : Math.min(cursorIndex, actions.length);
  // FGA clears enemy targeting at wave boundaries.
  const priorActions = plan[wave].slice(0, turn).flat().concat(actions.slice(0, cursor));
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
        className="fga-skill-editor fixed inset-0 z-50 flex min-h-0 flex-col"
      >
        <div className="fga-rotate-notice">
          <p>{t('skill.landscapeHint')}</p>
          <button className={button} aria-label={t('skill.done')} onClick={onClose}>
            {t('skill.back')}
          </button>
        </div>
        <header inert={resetting} className="fga-editor-header">
          {stage === 'main' && !choice ? (
            <div className="fga-enemies" role="group" aria-label={t('skill.enemyTargets')}>
              {'123'.split('').map((target) => (
                <button
                  key={target}
                  className="fga-enemy"
                  aria-label={t('skill.enemy', { number: target })}
                  aria-pressed={
                    enemyTarget?.type === 'enemyTarget' && enemyTarget.target === target
                  }
                  onClick={() => insert({ type: 'enemyTarget', target })}
                >
                  <span aria-hidden="true" className="fga-radio" />
                  {t('skill.enemyLabel', { number: target })}
                </button>
              ))}
            </div>
          ) : (
            <>
              <button
                className="fga-icon-button fga-back"
                onClick={back}
                aria-label={t('skill.back')}
              >
                <ArrowLeft size={24} />
              </button>
              <h1>{choice ? t('skill.chooseTarget') : stageTitle}</h1>
            </>
          )}
          <div className="fga-counter" title={name}>
            <span>{t('skill.waveCounter', { number: wave + 1 })}</span>
            <span>{t('skill.turnCounter', { number: turn + 1 })}</span>
          </div>
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
            <main
              inert={resetting}
              className="fga-editor-body flex-1 min-h-0 overflow-auto flex flex-col"
            >
              {choice ? (
                <section className="flex flex-1 min-h-0 flex-col gap-4" aria-label={stageTitle}>
                  <div className="flex-1 flex items-center justify-evenly gap-3">
                    {(special === 'two'
                      ? ['Ch2A', 'Ch2B']
                      : special === 'three'
                        ? ['Ch3A', 'Ch3B', 'Ch3C']
                        : special === 'other'
                          ? servantTargets.slice(3, 8)
                          : servantTargets.slice(0, 3)
                    ).map((target, index) => (
                      <button
                        key={target}
                        data-stage-focus={target === '1' ? true : undefined}
                        className="fga-button fga-target"
                        aria-label={t(`skill.targets.${target}`)}
                        style={{ backgroundColor: servantColors[index % 3] }}
                        onClick={() =>
                          multiple ? setTargets([...targets, target]) : applyTargets([target])
                        }
                      >
                        {['1', '2', '3'].includes(target)
                          ? t('skill.servantStack', { number: target })
                          : t(`skill.targets.${target}`)}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-1 items-center justify-center gap-2">
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
                  {choice.type === 'servantSkill' && (
                    <label className="flex items-center justify-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="fga-checkbox"
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
                  <div className="fga-special-targets">
                    <p>{t('skill.specialTargets')}</p>
                    <div>
                      <button
                        className={button}
                        onClick={() => setSpecial(special === 'two' ? null : 'two')}
                      >
                        {t('skill.twoOptions')}
                      </button>
                      <button
                        className={button}
                        onClick={() => setSpecial(special === 'three' ? null : 'three')}
                      >
                        {t('skill.threeOptions')}
                      </button>
                      <button
                        className={button}
                        onClick={() => setSpecial(special === 'other' ? null : 'other')}
                      >
                        {t('skill.otherOptions')}
                      </button>
                    </div>
                  </div>
                </section>
              ) : stage === 'attack' ? (
                <section className="flex flex-1 flex-col gap-4" aria-label={t('skill.attack')}>
                  <p className="text-center text-sm opacity-70">{t('skill.npOrder')}</p>
                  <div className="flex flex-1 items-center justify-center gap-4">
                    {'456'.split('').map((np, i) => (
                      <button
                        key={np}
                        data-stage-focus={i === 0 ? true : undefined}
                        className="fga-np"
                        aria-label={t('skill.np', { number: i + 1 })}
                        style={
                          nps.includes(np)
                            ? { backgroundColor: servantColors[nps.indexOf(np)], color: 'white' }
                            : undefined
                        }
                        aria-pressed={nps.includes(np)}
                        onClick={() =>
                          setNps(
                            nps.includes(np)
                              ? nps.filter((v) => v !== np)
                              : nps.length + cards < 3
                                ? [...nps, np]
                                : [...nps.slice(0, -1), np],
                          )
                        }
                      >
                        <span>{t('skill.servantStack', { number: i + 1 })}</span>
                        <span>{t('skill.npLabel')}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div role="group" aria-label={t('skill.beforeNp')}>
                      <p className="mb-2 text-sm">{t('skill.beforeNp')}</p>
                      <div className="flex gap-2">
                        {[0, 1, 2].map((n) => (
                          <button
                            className="fga-card-count"
                            disabled={n + nps.length > 3}
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
                      <button
                        className={primaryButtonClass}
                        aria-label={t('skill.nextTurn')}
                        onClick={() => attack(false)}
                      >
                        {t('skill.nextTurnLabel')}
                      </button>
                      <button
                        className={primaryButtonClass}
                        aria-label={t('skill.nextWave')}
                        onClick={() => attack(true)}
                      >
                        <FastForward size={20} />
                        {t('skill.nextWaveLabel')}
                      </button>
                    </div>
                  </div>
                </section>
              ) : stage === 'master' ? (
                <section className="flex flex-1 items-center justify-evenly gap-4 flex-wrap">
                  <button
                    data-stage-focus
                    className="fga-button fga-swap"
                    onClick={() => setStage('swap')}
                  >
                    {t('skill.swap')}
                  </button>
                  <div className="flex gap-3">
                    {'jkl'.split('').map((skill, i) => (
                      <button
                        className="fga-skill fga-master-skill"
                        aria-label={t('skill.master', { number: i + 1 })}
                        key={skill}
                        onClick={() => chooseSkill({ type: 'masterSkill', skill })}
                      >
                        {skill}
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
                  <div className="fga-history" aria-label={t('skill.history')}>
                    <button
                      className="fga-chip"
                      aria-label={t('skill.start')}
                      aria-pressed={wave === 0 && turn === 0 && cursor === 0}
                      onClick={() => {
                        setWave(0);
                        setTurn(0);
                        setCursor(0);
                      }}
                    >
                      &gt;
                    </button>
                    {plan.flatMap((waveActions, w) =>
                      waveActions.flatMap((turnActions, tr) => [
                        ...(w > 0 || tr > 0
                          ? [
                              <button
                                key={`${w}-${tr}-separator`}
                                className="fga-chip fga-separator"
                                aria-label={
                                  tr === 0
                                    ? t('skill.wave', { number: w + 1 })
                                    : t('skill.turn', { number: tr + 1 })
                                }
                                aria-pressed={wave === w && turn === tr && cursor === 0}
                                onClick={() => {
                                  setWave(w);
                                  setTurn(tr);
                                  setCursor(0);
                                }}
                              >
                                {tr === 0 ? ',#,' : ','}
                              </button>,
                            ]
                          : []),
                        ...turnActions.map((action, i) => (
                          <button
                            key={`${w}-${tr}-${i}`}
                            className="fga-chip"
                            style={{ backgroundColor: historyColor(action) }}
                            aria-label={`${i + 1}. ${actionCommand(action)}`}
                            aria-pressed={wave === w && turn === tr && cursor === i + 1}
                            onClick={() => {
                              setWave(w);
                              setTurn(tr);
                              setCursor(i + 1);
                            }}
                          >
                            {actionCommand(action)}
                          </button>
                        )),
                      ]),
                    )}
                  </div>
                  <div className="fga-edit-toolbar">
                    <button
                      className={button}
                      aria-label={t('skill.delete')}
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
                      <Trash2 size={18} />
                      {t('skill.deleteLabel')}
                    </button>
                    <button
                      className={button}
                      disabled={!command}
                      onClick={() => setResetting(true)}
                    >
                      <RotateCcw size={18} />
                      {t('skill.reset')}
                    </button>
                    <button className={button} aria-label={t('skill.done')} onClick={onClose}>
                      <Check size={20} />
                      {t('skill.finishLabel')}
                    </button>
                    <button
                      className="fga-icon-button"
                      aria-label={t('skill.undo')}
                      disabled={!canUndo}
                      onClick={onUndo}
                    >
                      <Undo2 size={20} />
                    </button>
                    <button
                      className="fga-icon-button"
                      aria-label={t('skill.redo')}
                      disabled={!canRedo}
                      onClick={onRedo}
                    >
                      <Redo2 size={20} />
                    </button>
                    <div className="fga-master-actions">
                      <button
                        className="fga-button fga-command-spell"
                        onClick={() => chooseSkill({ type: 'commandSpell', skill: 'o' })}
                      >
                        {t('skill.commandSpell')}
                      </button>
                      <button
                        className="fga-button fga-master-skill"
                        onClick={() => setStage('master')}
                      >
                        {t('skill.masterSkills')}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-1 min-h-12 items-center justify-end">
                    <button
                      className="fga-attack"
                      onClick={() => {
                        setNps([]);
                        setCards(0);
                        setStage('attack');
                      }}
                    >
                      {t('skill.attack')}
                    </button>
                  </div>
                  <div className="fga-servant-groups">
                    {[0, 1, 2].map((servant) => (
                      <div key={servant} className="fga-servant-group">
                        <div className="fga-skill-row">
                          {[0, 1, 2].map((skill) => (
                            <button
                              key={skill}
                              className="fga-skill"
                              style={{ backgroundColor: servantColors[servant] }}
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
                        <h2 className="mt-1 text-center">
                          {t('skill.servant', { number: servant + 1 })}
                        </h2>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </main>
            <footer inert={resetting} className="fga-command-preview sr-only">
              <pre aria-label={t('command')} className="overflow-x-auto text-xs whitespace-nowrap">
                {command || t('noCommand')}
              </pre>
            </footer>
          </>
        )}
        {resetting && (
          <div className="fga-reset-overlay">
            <section role="alertdialog" aria-label={t('skill.reset')}>
              <h2>{t('skill.resetQuestion')}</h2>
              <div>
                <button className={button} onClick={() => setResetting(false)}>
                  {t('skill.cancel')}
                </button>
                <button
                  className={button}
                  onClick={() => {
                    onChanged('');
                    setWave(0);
                    setTurn(0);
                    setCursor(null);
                    setResetting(false);
                  }}
                >
                  {t('skill.reset')}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </ModalPortal>
  );
}
