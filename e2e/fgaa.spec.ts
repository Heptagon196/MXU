import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

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

test('battle settings export original FGA types and retain inactive support values', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByRole('button', { name: '新建配置', exact: true }).click();
  await page.getByRole('button', { name: '战斗设置', exact: true }).click();
  await page.getByLabel('出战队伍', { exact: true }).selectOption('14');
  await page.getByLabel('配置区服', { exact: true }).selectOption('Cn');
  await page.getByRole('searchbox', { name: '搜索素材' }).fill('Bone');
  await page.getByRole('checkbox', { name: '凶骨', exact: true }).check();
  await page.getByRole('searchbox', { name: '搜索素材' }).fill('英雄');
  await page.getByRole('checkbox', { name: '英雄之证', exact: true }).check();
  await page.getByRole('button', { name: '移除 英雄之证', exact: true }).click();
  await page.getByLabel('启用 Raid 回合延时', { exact: true }).check();
  await page.getByLabel('回合延时（秒）', { exact: true }).selectOption('7');
  await page.getByLabel('自动选择敌方目标', { exact: true }).check();
  await page.getByLabel('助战职阶', { exact: true }).selectOption('Caster');
  await page.getByLabel('同时检查全部职阶', { exact: true }).check();
  await page.getByLabel('从者匹配项', { exact: true }).fill('servant-a\nservant-b\nservant-a');
  await page.getByRole('button', { name: '应用匹配项', exact: true }).first().click();
  await page.getByLabel('礼装必须满破', { exact: true }).check();
  await page.getByLabel('羁绊礼装效果', { exact: true }).selectOption('NP');
  await page.getByLabel('助战选择方式', { exact: true }).selectOption('Manual');
  await expect(page.getByLabel('礼装必须满破', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('礼装必须满破', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: '保存配置库', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 .fga', exact: true }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported).toMatchObject({
    autoskill_party: '14',
    battle_config_mat: ['Bone'],
    battle_config_server: 'Cn',
    add_raid_delay: true,
    raid_delay_seconds: '7',
    auto_choose_target: true,
    autoskill_support_class: 'Caster',
    also_check_all: true,
    support_pref_servant_list: ['servant-a', 'servant-b'],
    support_pref_ce_mlb: true,
    support_bond_ce_effect: 'NP',
    support_mode: 'Manual',
  });
  await writeFile('test-results/fgaa-settings.fga', JSON.stringify(exported));
  await page.reload();
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByRole('button', { name: '战斗设置', exact: true }).click();
  await expect(page.getByLabel('回合延时（秒）', { exact: true })).toHaveValue('7');
  await page.getByLabel('助战选择方式', { exact: true }).selectOption('Preferred');
  await expect(page.getByLabel('从者匹配项', { exact: true })).toHaveValue('servant-a\nservant-b');
  await expect(page.getByRole('button', { name: '移除 凶骨', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索素材' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/fgaa-materials.png', fullPage: true });
});

test('material selection preserves unknown imported identifiers', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByLabel('导入 .fga', { exact: true }).setInputFiles({
    name: 'future.fga',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ autoskill_name: '未来素材', battle_config_mat: ['FutureMaterial'] }),
    ),
  });
  await page.getByRole('button', { name: '战斗设置', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索素材' }).fill('凶骨');
  await page.getByRole('checkbox', { name: '凶骨', exact: true }).check();
  await expect(
    page.getByRole('button', { name: '移除 FutureMaterial', exact: true }),
  ).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 .fga', exact: true }).click();
  const download = await downloaded;
  expect(JSON.parse(await readFile((await download.path())!, 'utf8')).battle_config_mat).toEqual([
    'FutureMaterial',
    'Bone',
  ]);
});
