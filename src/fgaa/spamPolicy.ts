export const spamModes = ['None', 'Spam', 'Danger'] as const;
export const spamTargets = ['None', 'Self', 'Slot1', 'Slot2', 'Slot3', 'Left', 'Right'] as const;
export interface SpamAction {
  waves: number[];
  spam: string;
  target?: string;
  [key: string]: unknown;
}
export interface SpamSlot {
  skills: SpamAction[];
  np: SpamAction;
  [key: string]: unknown;
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalidSpamObject');
  return value as Record<string, unknown>;
};
function action(value: unknown, skill: boolean): SpamAction {
  const input = object(value);
  const waves = input.waves === undefined ? [1, 2, 3] : input.waves;
  const spam = input.spam === undefined ? 'None' : input.spam;
  const target = input.target === undefined ? 'None' : input.target;
  if (
    !Array.isArray(waves) ||
    waves.some((wave) => !Number.isInteger(wave) || wave < 1 || wave > 2147483647) ||
    !spamModes.includes(spam as (typeof spamModes)[number]) ||
    (skill && !spamTargets.includes(target as (typeof spamTargets)[number]))
  )
    throw new Error('invalidSpamAction');
  return {
    ...input,
    waves: [...waves],
    spam: spam as string,
    ...(skill ? { target: target as string } : {}),
  };
}
export function decodeSpam(source?: string): SpamSlot[] {
  const input: unknown = source === undefined ? [] : JSON.parse(source);
  if (!Array.isArray(input)) throw new Error('invalidSpam');
  return Array.from({ length: Math.max(6, input.length) }, (_, i) => {
    const slot = i < input.length ? object(input[i]) : {};
    const skills = slot.skills === undefined ? [{}, {}, {}] : slot.skills;
    if (!Array.isArray(skills) || skills.length !== 3) throw new Error('invalidSpamSkills');
    return {
      ...slot,
      skills: skills.map((value) => action(value, true)),
      np: action(slot.np === undefined ? {} : slot.np, false),
    };
  });
}
export function updateSpam(
  values: SpamSlot[],
  slot: number,
  skill: number | null,
  changes: Partial<SpamAction>,
): string {
  if (
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= values.length ||
    (skill !== null && ![0, 1, 2].includes(skill))
  )
    throw new Error('invalidSpamPosition');
  const next = structuredClone(values);
  if (skill === null) next[slot].np = { ...next[slot].np, ...changes };
  else next[slot].skills[skill] = { ...next[slot].skills[skill], ...changes };
  const result = JSON.stringify(next);
  decodeSpam(result);
  return result;
}
