export const servantTargets = [
  '1',
  '2',
  '3',
  '7',
  '8',
  'K',
  'U',
  'M',
  'Ch2A',
  'Ch2B',
  'Ch3A',
  'Ch3B',
  'Ch3C',
] as const;
export type Action =
  | { type: 'servantSkill'; skill: string; targets: string[] }
  | { type: 'masterSkill' | 'commandSpell'; skill: string; target: string | null }
  | { type: 'enemyTarget'; target: string }
  | { type: 'orderChange'; starting: string; sub: string }
  | { type: 'attack'; nps: string[]; cardsBeforeNP: number };
export type SkillPlan = Action[][][];
const targetSet = new Set<string>(servantTargets);
const targetCode = (target: string) => (target.length === 1 ? target : `[${target}]`);
export function actionCommand(action: Action): string {
  switch (action.type) {
    case 'servantSkill':
      return (
        action.skill +
        (action.targets.length > 1
          ? `(${action.targets.map(targetCode).join('')})`
          : action.targets.map(targetCode).join(''))
      );
    case 'masterSkill':
    case 'commandSpell':
      return action.skill + (action.target ? targetCode(action.target) : '');
    case 'enemyTarget':
      return `t${action.target}`;
    case 'orderChange':
      return `x${action.starting}${action.sub}`;
    case 'attack':
      return action.nps.length === 0 && action.cardsBeforeNP === 0
        ? '0'
        : action.nps.join('') + (action.cardsBeforeNP ? `n${action.cardsBeforeNP}` : '');
  }
}
export const planCommand = (plan: SkillPlan) =>
  plan.map((wave) => wave.map((turn) => turn.map(actionCommand).join('')).join(',')).join(',#,');

/** Editor grammar only. Game execution still uses the original FGA parser.
 * A command that cannot be edited is preserved verbatim by the library.
 */
export function parseCommand(command: string): SkillPlan {
  if (command.length > 65536) throw new Error('commandTooLong');
  return command.split(',#,').map((wave) =>
    wave.split(',').map((turn) => {
      let position = 0;
      const actions: Action[] = [];
      const take = () => {
        if (position >= turn.length) throw new Error('incompleteCommand');
        return turn[position++];
      };
      const slot = () => {
        const value = take();
        if (!'123'.includes(value)) throw new Error('invalidSlot');
        return value;
      };
      const target = (): string | null => {
        if (turn[position] === '[') {
          position++;
          const end = turn.indexOf(']', position);
          if (end < 0) throw new Error('incompleteTarget');
          const value = turn.slice(position, end);
          position = end + 1;
          if (!targetSet.has(value) || value.length === 1) throw new Error('invalidTarget');
          return value;
        }
        if (position < turn.length && targetSet.has(turn[position])) return take();
        return null;
      };
      while (position < turn.length) {
        const token = take();
        let action: Action;
        if ('abcdefghi'.includes(token)) {
          const targets: string[] = [];
          if (turn[position] === '(') {
            position++;
            while (position < turn.length && turn[position] !== ')') {
              const value = target();
              if (value === null) throw new Error('invalidTarget');
              targets.push(value);
            }
            if (take() !== ')') throw new Error('incompleteTarget');
          } else {
            const value = target();
            if (value) targets.push(value);
          }
          action = { type: 'servantSkill', skill: token, targets };
        } else if ('jkl'.includes(token) || token === 'o') {
          action = {
            type: token === 'o' ? 'commandSpell' : 'masterSkill',
            skill: token,
            target: target(),
          };
        } else if (token === 't') action = { type: 'enemyTarget', target: slot() };
        else if (token === 'x') action = { type: 'orderChange', starting: slot(), sub: slot() };
        else if ('4560n'.includes(token)) {
          const countToken = token === 'n' ? take() : '0';
          if (!'012'.includes(countToken)) throw new Error('invalidAttack');
          const count = Number(countToken);
          if (!Number.isInteger(count) || count < 0 || count > 2) throw new Error('invalidAttack');
          action = {
            type: 'attack',
            nps: '456'.includes(token) ? [token] : [],
            cardsBeforeNP: count,
          };
          const previous = actions[actions.length - 1];
          if (previous?.type === 'attack') {
            action = {
              type: 'attack',
              nps: [...new Set([...previous.nps, ...action.nps])],
              cardsBeforeNP: previous.cardsBeforeNP + count,
            };
            if (action.cardsBeforeNP > 2) throw new Error('invalidAttack');
            actions.pop();
          }
        } else throw new Error(`unknownCommand:${token}`);
        actions.push(action);
      }
      return actions;
    }),
  );
}
export function insertAction(
  plan: SkillPlan,
  wave: number,
  turn: number,
  cursor: number,
  action: Action,
): SkillPlan {
  const result = structuredClone(plan);
  const actions = result[wave]?.[turn];
  if (!actions || cursor < 0 || cursor > actions.length) throw new Error('invalidCursor');
  actions.splice(cursor, 0, action);
  return parseCommand(planCommand(result));
}
export function insertAttack(
  plan: SkillPlan,
  wave: number,
  turn: number,
  cursor: number,
  attack: Extract<Action, { type: 'attack' }>,
  nextWave: boolean,
): SkillPlan {
  const result = structuredClone(plan);
  const actions = result[wave]?.[turn];
  if (!actions || cursor < 0 || cursor > actions.length) throw new Error('invalidCursor');
  const remaining = actions.splice(cursor);
  actions.push(attack);
  if (nextWave) {
    const laterTurns = result[wave].splice(turn + 1);
    result.splice(wave + 1, 0, [remaining, ...laterTurns]);
  } else result[wave].splice(turn + 1, 0, remaining);
  return parseCommand(planCommand(result));
}
