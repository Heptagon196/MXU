export const defaultCards = ['WB', 'WA', 'WQ', 'B', 'A', 'Q', 'RB', 'RA', 'RQ'];
export const defaultServants = ['1', '2', '3', '4', '5', '6'];

export function priorityRows(source: string, servant = false): string[][] {
  if (!source.trim()) return [[...(servant ? defaultServants : defaultCards)]];
  return source.split('\n').map((line) => {
    const row = line.split(',').map((token) => {
      if (servant) {
        // FGA uses String.toInt without trimming servant tokens.
        if (!/^[+]?[1-6]$/.test(token)) throw new Error('invalidServantPriority');
        return String(Number(token));
      }
      return token
        .trim()
        .toUpperCase()
        .replace(/^X(?=[BAQ]$)/, '');
    });
    if (!servant && (row.length !== 9 || row.some((value) => !defaultCards.includes(value))))
      throw new Error('invalidCardPriority');
    return row;
  });
}
export const serializePriority = (rows: string[][]) => rows.map((row) => row.join(',')).join('\n');

export function movePriority(rows: string[][], wave: number, from: number, to: number): string[][] {
  const next = rows.map((row) => [...row]);
  if (!next[wave] || from < 0 || to < 0 || from >= next[wave].length || to >= next[wave].length)
    throw new Error('invalidPriorityPosition');
  next[wave].splice(to, 0, next[wave].splice(from, 1)[0]);
  return next;
}
