import test from 'node:test';
import assert from 'node:assert/strict';
import { globalGroups, globalKeys } from '../src/fgaa/globalSettings';
import { chaldeaGroups, validateChaldeaSettings } from '../src/fgaa/chaldeaSettings';

test('FGA categories contain every setting once and Chaldea payload rejects missing or unknown values', () => {
  const fields = Object.values(globalGroups).flat();
  assert.deepEqual([...fields].sort(), [...globalKeys].sort());
  assert.equal(new Set(fields).size, fields.length);
  const values = Object.fromEntries(
    Object.values(chaldeaGroups)
      .flat()
      .map((key) => [key, false]),
  );
  assert.deepEqual(validateChaldeaSettings(values), values);
  for (const data of [{}, { ...values, data: 'true' }, { ...values, secrets: {} }])
    assert.throws(() => validateChaldeaSettings(data));
});
