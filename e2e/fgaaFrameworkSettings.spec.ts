import { test, expect } from '@playwright/test';
test('framework settings share MXU state and preserve unsaved FGA fields across sections', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: '全局设置', exact: true }).click();
  await page.getByLabel('技能等待（毫秒）', { exact: true }).fill('850');
  await page.getByRole('button', { name: '主框架', exact: true }).click();
  await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'FGA', exact: true }).click();
  await expect(page.getByLabel('技能等待（毫秒）', { exact: true })).toHaveValue('850');
  await page.getByRole('button', { name: '保存全局设置' }).click();
  await page.getByRole('tab', { name: '自动化', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('tab', { name: '全局设置', exact: true }).click();
  await page.getByRole('button', { name: '主框架', exact: true }).click();
  await page.screenshot({ path: 'test-results/fgaa-framework-settings.png', fullPage: true });
});
