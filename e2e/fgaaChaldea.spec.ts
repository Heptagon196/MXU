import { test, expect } from '@playwright/test';

test('built Chaldea module starts inside the product tab', async ({ page }) => {
  test.skip(
    process.env.FGAA_CHALDEA_SMOKE !== '1',
    'Requires tools/build-chaldea.ps1 and a fresh MXU build',
  );
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Chaldea', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Chaldea"]');
  await expect(frame.locator('flt-glass-pane')).toBeAttached({ timeout: 60000 });
  const semantics = frame.locator('flt-semantics-placeholder');
  if (await semantics.count()) await semantics.press('Enter');
  await expect(frame.locator('flt-semantics')).not.toHaveCount(0, { timeout: 30000 });
  console.log('Chaldea semantics:', await frame.locator('body').innerText());
  await page.screenshot({ path: 'test-results/chaldea-module.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('local Chaldea module loads lazily and survives tab changes', async ({ page }) => {
  let requests = 0;
  await page.route('**/chaldea/index.html', (route) => {
    requests++;
    return route.fulfill({
      contentType: 'text/html',
      body: '<html data-fgaa="true"><body><input aria-label="模块状态" /></body></html>',
    });
  });
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  expect(requests).toBe(0);
  await page.getByRole('tab', { name: 'Chaldea', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Chaldea"]');
  await frame.getByLabel('模块状态').fill('保留原模块状态');
  const loaded = requests;
  await page.getByRole('tab', { name: '战斗配置', exact: true }).click();
  await page.getByRole('tab', { name: 'Chaldea', exact: true }).click();
  await expect(frame.getByLabel('模块状态')).toHaveValue('保留原模块状态');
  expect(requests).toBe(loaded);
});

test('missing module rejects SPA fallback and can retry', async ({ page }) => {
  let available = false;
  await page.route('**/chaldea/index.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: available
        ? '<html data-fgaa="true"><body>local module</body></html>'
        : '<html><body>MXU fallback</body></html>',
    }),
  );
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Chaldea', exact: true }).click();
  await expect(
    page.getByText('未找到 Chaldea 模块，请安装完整应用。', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  available = true;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.frameLocator('iframe').getByText('local module')).toBeVisible();
});
