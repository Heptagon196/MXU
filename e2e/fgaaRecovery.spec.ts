import { test, expect } from '@playwright/test';

test('global settings can reload after a failed save and restore the previous draft explicitly', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('mxu-language', 'zh-CN');
    sessionStorage.setItem('fail-settings-write', 'yes');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'fgaa.global-settings.v1' && sessionStorage.getItem('fail-settings-write'))
        throw new Error('Storage full');
      return original.call(this, key, value);
    };
  });
  await page.goto('/');
  await page.getByRole('tab', { name: '全局设置', exact: true }).click();
  const delay = page.getByLabel('技能等待（毫秒）', { exact: true });
  await delay.fill('900');
  await page.getByRole('button', { name: '保存全局设置' }).click();
  await expect(page.getByRole('status')).toContainText('保存失败');
  await page.evaluate(() => {
    sessionStorage.removeItem('fail-settings-write');
    localStorage.setItem(
      'fgaa.global-settings.v1',
      JSON.stringify({ version: 1, values: { skill_delay: 750 } }),
    );
  });
  await page.getByRole('button', { name: '重新读取', exact: true }).click();
  await expect(delay).toHaveValue('750');
  await page.getByRole('button', { name: '恢复设置草稿', exact: true }).click();
  await expect(delay).toHaveValue('900');
  await page.getByRole('button', { name: '保存全局设置' }).click();
  await expect(page.getByRole('status')).toHaveText('已保存');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('fgaa.global-settings.v1')!).values.skill_delay,
    ),
  ).toBe(900);
});

test('failed save can reload a newer library and recover the draft as independent copies', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('mxu-language', 'zh-CN');
    localStorage.setItem(
      'fgaa.battle-library.v1',
      JSON.stringify({
        version: 1,
        entries: [{ id: 'existing', data: { autoskill_name: '旧版' } }],
      }),
    );
    sessionStorage.setItem('fail-library-write', 'yes');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'fgaa.battle-library.v1' && sessionStorage.getItem('fail-library-write'))
        throw new Error('Storage full');
      return original.call(this, key, value);
    };
  });
  await page.goto('/');
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByLabel('配置名称', { exact: true }).fill('未保存草稿');
  await page.getByRole('button', { name: '保存配置库', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('保存失败，编辑已保留');
  await page.evaluate(() => {
    sessionStorage.removeItem('fail-library-write');
    localStorage.setItem(
      'fgaa.battle-library.v1',
      JSON.stringify({
        version: 1,
        entries: [{ id: 'existing', data: { autoskill_name: '磁盘新版本' } }],
      }),
    );
  });
  await page.getByRole('button', { name: '重新读取', exact: true }).click();
  await expect(page.getByLabel('配置名称', { exact: true })).toHaveValue('磁盘新版本');
  await page.getByRole('button', { name: '将草稿恢复为副本', exact: true }).click();
  await expect(page.getByLabel('配置名称', { exact: true })).toHaveValue('未保存草稿');
  await page.getByRole('button', { name: '保存配置库', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('已保存');
  const entries = await page.evaluate(
    () => JSON.parse(localStorage.getItem('fgaa.battle-library.v1')!).entries,
  );
  expect(
    entries.map((entry: { data: { autoskill_name: string } }) => entry.data.autoskill_name),
  ).toEqual(['磁盘新版本', '未保存草稿']);
  expect(entries[0].id).not.toBe(entries[1].id);
});
