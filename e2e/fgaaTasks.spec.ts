import { test, expect } from '@playwright/test';
import { createFgaInterface } from '../src/fgaa/taskInterface';
import zh from '../src/i18n/locales/fgaa-zh-CN';

test('FGA project loads through MXU and exposes per-task launch options', async ({ page }) => {
  const pi = createFgaInterface();
  pi.languages = { zh_cn: 'i18n/zh-CN.json' };
  const flatten = (value: object, prefix = '', output: Record<string, string> = {}) => {
    for (const [key, item] of Object.entries(value)) {
      const name = prefix ? `${prefix}.${key}` : key;
      if (typeof item === 'string') output[name] = item;
      else flatten(item, name, output);
    }
    return output;
  };
  await page.route('**/api/interface', (route) => route.fulfill({ status: 404 }));
  await page.route('**/interface.json', (route) => route.fulfill({ json: pi }));
  await page.route('**/i18n/zh-CN.json', (route) => route.fulfill({ json: flatten(zh) }));
  await page.addInitScript(() => {
    localStorage.setItem('mxu-language', 'zh-CN');
    localStorage.setItem(
      'fgaa.battle-library.v1',
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'fixture-battle',
            data: { autoskill_name: '素材队', autoskill_cmd: 'a1', battle_config_server: 'Cn' },
          },
        ],
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: '跳过（DEV）', exact: true }).click();
  await page.getByRole('button', { name: '刷本', exact: true }).click();
  await expect(page.getByText('补充体力资源', { exact: true })).toBeVisible();
  await page.getByRole('switch', { name: '限制刷本次数', exact: true }).click();
  await expect(page.getByText('刷本次数上限', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '请选择战斗配置', exact: true }).click();
  await page.getByRole('option', { name: '素材队', exact: true }).click();
  await page.getByRole('spinbutton').nth(1).fill('12');
  await page.getByRole('spinbutton').nth(1).blur();
  await page.getByRole('button', { name: '刷本 1', exact: true }).press('Enter');
  await expect(page.getByRole('spinbutton').nth(1)).toHaveValue('12');
  await expect(
    page.getByRole('switch', { name: /^限制刷本次数/ }).nth(1),
  ).not.toBeChecked();
  await page.screenshot({ path: 'test-results/fgaa-tasks.png', fullPage: true });
});
