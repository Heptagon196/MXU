import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('feature tabs retain a saved FGA library and export unknown fields intact', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  const original = {
    autoskill_name: '素材本',
    autoskill_cmd: 'a(11),0,#,b2',
    autoskill_party: '14',
    future: { keep: [1, true] },
  };
  await page.getByLabel('导入 .fga', { exact: true }).setInputFiles({
    name: 'sample.fga',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(original)),
  });
  await expect(page.getByLabel('配置名称', { exact: true })).toHaveValue('素材本');
  await page.getByLabel('配置名称', { exact: true }).fill('素材本 · MXU');
  await page.getByRole('button', { name: '保存配置库', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('已保存');
  await page.getByRole('tab', { name: 'Chaldea', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chaldea 模块正在接入' })).toBeVisible();
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await expect(page.getByLabel('配置名称', { exact: true })).toHaveValue('素材本 · MXU');
  await page.reload();
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await expect(page.getByLabel('配置名称', { exact: true })).toHaveValue('素材本 · MXU');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 .fga', exact: true }).click();
  const download = await downloaded;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported).toEqual({ ...original, autoskill_name: '素材本 · MXU' });
  await page.screenshot({ path: 'test-results/fgaa-battle.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('mobile tabs and empty library remain operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByRole('button', { name: '新建配置', exact: true }).click();
  await expect(page.getByLabel('配置名称', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('skill board preserves repeated targets, NP order and undo across tabs', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByRole('button', { name: '新建配置', exact: true }).click();
  await page.getByRole('button', { name: '从者 1 技能 1', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: '从者 1', exact: true }).click();
  await dialog.getByRole('button', { name: '从者 1', exact: true }).click();
  await dialog.getByRole('button', { name: '添加', exact: true }).click();
  const command = page.locator('main pre');
  await expect(command).toHaveText('a(11)');
  await page.getByRole('button', { name: '宝具 3', exact: true }).click();
  await page.getByRole('button', { name: '宝具 1', exact: true }).click();
  await page.getByLabel('宝具前普通卡数').selectOption('1');
  await page.getByRole('button', { name: '出牌 → 下一波次', exact: true }).click();
  await expect(command).toHaveText('a(11)64n1,#,');
  await page.getByRole('tab', { name: 'Chaldea', exact: true }).click();
  await page.getByRole('tab', { name: /^战斗配置/ }).click();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(command).toHaveText('a(11)');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(command).toHaveText('a(11)64n1,#,');
  await page.getByRole('button', { name: '波次 1', exact: true }).click();
  await page.getByRole('button', { name: '1. a(11)', exact: true }).click();
  await page.getByRole('button', { name: '敌方 2', exact: true }).click();
  await expect(command).toHaveText('a(11)t264n1,#,');
  await page.getByRole('button', { name: '保存配置库', exact: true }).click();
  await page.getByRole('heading', { name: '技能顺序', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/fgaa-skill.png', fullPage: true });
  await page.reload();
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await expect(command).toHaveText('a(11)t264n1,#,');
});

test('invalid merged attacks leave the original configuration editable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByLabel('导入 .fga', { exact: true }).setInputFiles({
    name: 'attacks.fga',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ autoskill_name: '出牌边界', autoskill_cmd: 'n2an2' })),
  });
  await page.getByRole('button', { name: '2. a', exact: true }).click();
  await page.getByRole('button', { name: '删除选中动作', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('原指令未修改');
  await expect(page.locator('main pre')).toHaveText('n2an2');
  await page.getByRole('button', { name: '敌方 1', exact: true }).click();
  await expect(page.locator('main pre')).toHaveText('n2at1n2');
});
