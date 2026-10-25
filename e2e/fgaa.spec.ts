import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

async function choose(page: Page, trigger: Locator, value: string) {
  await trigger.click();
  await page.getByRole('listbox').locator(`[role="option"][data-value="${value}"]`).click();
}

test('feature tabs retain a saved FGA library and export unknown fields intact', async ({
  page,
}) => {
  const errors: string[] = [];
  await page.route('**/chaldea/index.html', (route) => route.fulfill({ status: 404 }));
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
  await expect(
    page.getByText('未找到 Chaldea 模块，请安装完整应用。', { exact: true }),
  ).toBeVisible();
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

test('full-screen editor preserves targets, attacks, history and saved commands', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByRole('button', { name: '新建配置', exact: true }).click();
  await expect(page.getByRole('button', { name: '从者 1 技能 1', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '编辑技能顺序', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '技能顺序', exact: true });
  expect(await editor.boundingBox()).toEqual({ x: 0, y: 0, width: 1360, height: 900 });
  const command = editor.getByLabel('技能指令预览');
  await editor.getByRole('button', { name: '从者 1 技能 1', exact: true }).click();
  await editor.getByRole('checkbox').check();
  await editor.getByRole('button', { name: '从者 1', exact: true }).click();
  await editor.getByRole('button', { name: '从者 1', exact: true }).click();
  await editor.getByRole('button', { name: '添加', exact: true }).click();
  await expect(command).toHaveText('a(11)');
  await editor.getByRole('button', { name: '攻击', exact: true }).click();
  await editor.getByRole('button', { name: '宝具 3', exact: true }).click();
  await editor.getByRole('button', { name: '宝具 1', exact: true }).click();
  await editor
    .getByRole('group', { name: '宝具前普通卡数' })
    .getByRole('button', { name: '1', exact: true })
    .click();
  await expect(
    editor
      .getByRole('group', { name: '宝具前普通卡数' })
      .getByRole('button', { name: '1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/fgaa-fullscreen-attack.png' });
  await editor.getByRole('button', { name: '出牌 → 下一波次', exact: true }).click();
  await expect(command).toHaveText('a(11)64n1,#,');
  await editor.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(command).toHaveText('a(11)');
  await editor.getByRole('button', { name: '重做', exact: true }).click();
  await expect(command).toHaveText('a(11)64n1,#,');
  await editor.getByRole('button', { name: '波次 1', exact: true }).click();
  await editor.getByRole('button', { name: '1. a(11)', exact: true }).click();
  await editor.getByRole('button', { name: '敌方 2', exact: true }).click();
  await expect(command).toHaveText('a(11)t264n1,#,');
  await expect(editor.getByRole('button', { name: '敌方 2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await editor.getByRole('button', { name: '波次 2', exact: true }).click();
  await expect(editor.getByRole('button', { name: '敌方 2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await editor.getByRole('button', { name: '波次 1', exact: true }).click();
  await page.screenshot({ path: 'test-results/fgaa-fullscreen-main.png' });
  await editor.getByRole('button', { name: '完成编辑', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.getByRole('button', { name: '保存配置库', exact: true }).click();
  await page.reload();
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await expect(page.locator('main pre')).toHaveText('a(11)t264n1,#,');
});

test('full-screen steps cancel safely and restore entry focus in a short viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByRole('button', { name: '新建配置', exact: true }).click();
  const entry = page.getByRole('button', { name: '编辑技能顺序', exact: true });
  await entry.click();
  const editor = page.getByRole('dialog');
  await editor.getByRole('button', { name: '从者 1 技能 1', exact: true }).click();
  await editor.getByRole('checkbox').check();
  for (let i = 0; i < 20; i++)
    await editor.getByRole('button', { name: '从者 1', exact: true }).click();
  await editor.getByRole('button', { name: '添加', exact: true }).scrollIntoViewIfNeeded();
  await expect(editor.getByRole('button', { name: '添加', exact: true })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(editor.getByRole('button', { name: '攻击', exact: true })).toBeVisible();
  await expect(editor.getByLabel('技能指令预览')).toHaveText('尚未配置技能顺序');
  await editor.getByRole('button', { name: '御主技能', exact: true }).click();
  await editor.getByRole('button', { name: '换人', exact: true }).click();
  await editor
    .getByRole('group', { name: '前排位置' })
    .getByRole('button', { name: '从者 2', exact: true })
    .click();
  await editor
    .getByRole('group', { name: '后排位置' })
    .getByRole('button', { name: '从者 6', exact: true })
    .click();
  await editor.getByRole('button', { name: '换人', exact: true }).click();
  await expect(editor.getByLabel('技能指令预览')).toHaveText('x23');
  await editor.getByRole('button', { name: '从者 2 技能 2', exact: true }).click();
  await page.screenshot({ path: 'test-results/fgaa-fullscreen-target-short.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(entry).toBeFocused();
  await expect(page.locator('main pre')).toHaveText('x23');
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
  await page.getByRole('button', { name: '编辑技能顺序', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByRole('button', { name: '2. a', exact: true }).click();
  await editor.getByRole('button', { name: '删除选中动作', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('原指令未修改');
  await expect(editor.getByLabel('技能指令预览')).toHaveText('n2an2');
  await editor.getByRole('button', { name: '敌方 1', exact: true }).click();
  await expect(editor.getByLabel('技能指令预览')).toHaveText('n2at1n2');
});

test('battle settings export original FGA types and retain inactive support values', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByRole('button', { name: '新建配置', exact: true }).click();
  await page.getByRole('button', { name: '战斗设置', exact: true }).click();
  await choose(page, page.getByLabel('出战队伍', { exact: true }), '14');
  await page.getByText('指令卡与洗牌', { exact: true }).click();
  const cards = page.getByRole('group', { name: '指令卡优先级', exact: true });
  await cards.getByRole('button', { name: '上移 克制 Arts', exact: true }).click();
  await cards.getByRole('button', { name: '新增波次', exact: true }).click();
  await cards.getByRole('button', { name: '上移 克制 Quick', exact: true }).click();
  await page.getByLabel('启用从者选卡优先级', { exact: true }).check();
  const servants = page.getByRole('group', { name: '从者优先级', exact: true });
  await servants.getByRole('button', { name: '上移 队伍位置 2', exact: true }).click();
  const brave = page.getByRole('group', { name: 'Brave Chain', exact: true });
  await choose(page, brave.getByRole('button', { name: '波次 1', exact: true }), 'WithNP');
  await brave.getByRole('button', { name: '新增波次', exact: true }).click();
  await choose(page, brave.getByRole('button', { name: '波次 2', exact: true }), 'Avoid');
  await choose(
    page,
    page
      .getByRole('group', { name: '指令卡重排', exact: true })
      .getByRole('button', { name: '波次 1', exact: true }),
    'T',
  );
  await choose(page, page.getByLabel('洗牌条件', { exact: true }), 'NoNPMatching');
  await choose(page, page.getByLabel('洗牌波次', { exact: true }), '2');
  await page.getByText('技能与宝具连发', { exact: true }).click();
  const skillSpam = page.getByRole('group', { name: '技能 1', exact: true });
  await choose(page, skillSpam.getByRole('button', { name: '触发条件', exact: true }), 'Danger');
  await choose(page, skillSpam.getByRole('button', { name: '技能目标', exact: true }), 'Self');
  await skillSpam.getByRole('checkbox', { name: '波次 1', exact: true }).uncheck();
  await skillSpam.getByRole('button', { name: '添加波次', exact: true }).click();
  await choose(page, skillSpam.getByRole('button', { name: '触发条件', exact: true }), 'None');
  await expect(skillSpam.getByRole('button', { name: '技能目标', exact: true })).toHaveAttribute(
    'value',
    'Self',
  );
  await expect(skillSpam.getByRole('button', { name: '技能目标', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '队伍位置 6', exact: true }).click();
  await choose(
    page,
    page
      .getByRole('group', { name: '宝具', exact: true })
      .getByRole('button', { name: '触发条件', exact: true }),
    'Spam',
  );
  await choose(page, page.getByLabel('配置区服', { exact: true }), 'Cn');
  await page.getByRole('searchbox', { name: '搜索素材' }).fill('Bone');
  await page.getByRole('checkbox', { name: '凶骨', exact: true }).check();
  await page.getByRole('searchbox', { name: '搜索素材' }).fill('英雄');
  await page.getByRole('checkbox', { name: '英雄之证', exact: true }).check();
  await page.getByRole('button', { name: '移除 英雄之证', exact: true }).click();
  await page.getByLabel('启用 Raid 回合延时', { exact: true }).check();
  await choose(page, page.getByLabel('回合延时（秒）', { exact: true }), '7');
  await page.getByLabel('自动选择敌方目标', { exact: true }).check();
  await choose(page, page.getByLabel('助战职阶', { exact: true }), 'Caster');
  await page.getByLabel('同时检查全部职阶', { exact: true }).check();
  await page.getByLabel('从者匹配项', { exact: true }).fill('servant-a\nservant-b\nservant-a');
  await page.getByRole('button', { name: '应用匹配项', exact: true }).first().click();
  await page.getByLabel('礼装必须满破', { exact: true }).check();
  await choose(page, page.getByLabel('羁绊礼装效果', { exact: true }), 'NP');
  await choose(page, page.getByLabel('助战选择方式', { exact: true }), 'Manual');
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
    card_priority: 'WA,WB,WQ,B,A,Q,RB,RA,RQ\nWA,WQ,WB,B,A,Q,RB,RA,RQ',
    servant_priority: '2,1,3,4,5,6',
    use_servant_priority: true,
    auto_skill_brave_chains: 'WithNP,Avoid',
    auto_skill_rearrange_cards: 'T',
    shuffle_cards: 'NoNPMatching',
    shuffle_cards_wave: 2,
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
  expect(typeof exported.spam_x).toBe('string');
  const spam = JSON.parse(exported.spam_x);
  expect(spam[0].skills[0]).toEqual({ spam: 'None', target: 'Self', waves: [2, 3, 4] });
  expect(spam[5].np.spam).toBe('Spam');
  expect(spam[1].np.spam).toBe('None');
  await page.reload();
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByRole('button', { name: '战斗设置', exact: true }).click();
  await expect(page.getByLabel('回合延时（秒）', { exact: true })).toHaveAttribute('value', '7');
  await choose(page, page.getByLabel('助战选择方式', { exact: true }), 'Preferred');
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

test('MXU dropdown keyboard navigation and viewport placement', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByRole('button', { name: '新建配置', exact: true }).click();
  await page.setViewportSize({ width: 640, height: 360 });
  await page.getByRole('button', { name: '战斗设置', exact: true }).click();
  const trigger = page.getByLabel('出战队伍', { exact: true });
  await trigger.focus();
  await trigger.press('ArrowDown');
  const menu = page.getByRole('listbox');
  await expect(menu).toBeVisible();
  await menu.press('End');
  await menu.press('Enter');
  await expect(trigger).toHaveAttribute('value', '14');
  await expect(trigger).toBeFocused();
  await trigger.press('ArrowDown');
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(640);
  expect(box!.y + box!.height).toBeLessThanOrEqual(360);
  await page.screenshot({ path: 'test-results/fgaa-mxu-dropdown.png', animations: 'disabled' });
  await menu.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
