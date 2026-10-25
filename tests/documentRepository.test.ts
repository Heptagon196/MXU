import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentRepository } from '../src/fgaa/documentRepository';

test('native migration validates first, preserves legacy and honors the authoritative file', async () => {
  let disk: string | null = null;
  let writes = 0;
  const port = {
    read: async () => disk,
    save: async (expected: string | null, value: string) => {
      assert.equal(expected, disk);
      writes++;
      disk = value;
    },
  };
  const repo = documentRepository(port);
  await assert.rejects(repo.save('{}'));
  await assert.rejects(repo.load(() => 'invalid', JSON.parse));
  assert.equal(writes, 0);
  const legacy = '{"version":1}';
  assert.deepEqual(
    await repo.load(
      () => legacy,
      (value) => JSON.parse(value!),
    ),
    { version: 1 },
  );
  assert.equal(disk, legacy);
  assert.equal(writes, 1);
  await repo.load(
    () => {
      throw new Error('Legacy must not override native');
    },
    (value) => value,
  );
  assert.equal(writes, 1);
  await repo.save('{"version":1,"next":true}');
  assert.equal(writes, 2);
  disk = 'invalid';
  await assert.rejects(
    repo.load(
      () => legacy,
      (value) => JSON.parse(value!),
    ),
  );
  await assert.rejects(repo.save(legacy));
  assert.equal(disk, 'invalid');
});

test('failed and concurrent writes never advance the loaded revision', async () => {
  let rejectWrite: (reason: Error) => void = () => {};
  const expectedRevisions: (string | null)[] = [];
  const repo = documentRepository({
    read: async () => 'original',
    save: (expected) => {
      expectedRevisions.push(expected);
      return new Promise<void>((_, reject) => {
        rejectWrite = reject;
      });
    },
  });
  await repo.load(
    () => null,
    (value) => value,
  );
  const failed = repo.save('new');
  await assert.rejects(repo.save('concurrent'));
  rejectWrite(new Error('disk full'));
  await assert.rejects(failed);
  const retry = repo.save('retry');
  rejectWrite(new Error('still full'));
  await assert.rejects(retry);
  assert.deepEqual(expectedRevisions, ['original', 'original']);
});
