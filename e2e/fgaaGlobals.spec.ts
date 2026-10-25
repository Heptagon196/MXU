import { test, expect } from '@playwright/test';
test('FGA global settings save, reload and reject invalid numeric values', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: '全局设置', exact: true }).click();
  await page.getByLabel('技能等待（毫秒）', { exact: true }).fill('750');
  await page.getByLabel('跳过剧情', { exact: true }).check();
  await page.getByRole('button', { name: '保存全局设置' }).click();
  await expect(page.getByRole('status')).toHaveText('已保存');
  await page.reload();
  await page.getByRole('tab', { name: '全局设置', exact: true }).click();
  await expect(page.getByLabel('技能等待（毫秒）', { exact: true })).toHaveValue('750');
  await expect(page.getByLabel('跳过剧情', { exact: true })).toBeChecked();
  await page.getByLabel('图像匹配相似度（%）', { exact: true }).fill('101');
  await page.getByRole('button', { name: '保存全局设置' }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('fgaa.global-settings.v1')!).values.min_similarity,
    ),
  ).toBe(80);
  await page.getByLabel('图像匹配相似度（%）', { exact: true }).fill('80');
  await page.screenshot({ path: 'test-results/fgaa-global-settings.png', fullPage: true });
});

test('storage failure keeps edits visible and reports failure', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mxu-language', 'zh-CN');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'fgaa.global-settings.v1') throw new Error('Storage full');
      return original.call(this, key, value);
    };
  });
  await page.goto('/');
  await page.getByRole('tab', { name: '全局设置', exact: true }).click();
  await page.getByLabel('技能等待（毫秒）', { exact: true }).fill('900');
  await page.getByRole('button', { name: '保存全局设置' }).click();
  await expect(page.getByRole('status')).toHaveText('保存失败，请检查数值或存储空间。');
  await expect(page.getByLabel('技能等待（毫秒）', { exact: true })).toHaveValue('900');
});
