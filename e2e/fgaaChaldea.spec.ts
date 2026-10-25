import { test, expect } from '@playwright/test';

test('module settings are grouped and persist in the real Chaldea database', async ({ page }) => {
  test.skip(process.env.FGAA_CHALDEA_SMOKE !== '1', 'Requires built Chaldea module');
  test.setTimeout(90000);
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  const openSettings = async () => {
    await page.getByRole('tab', { name: '全局设置', exact: true }).click();
    const categories = page.getByRole('navigation', { name: '设置分类' });
    await expect(categories.getByRole('button', { name: '主框架', exact: true })).toBeVisible();
    await expect(categories.getByRole('button', { name: 'FGA', exact: true })).toBeVisible();
    await categories.getByRole('button', { name: 'Chaldea', exact: true }).click();
    await expect(page.getByRole('group', { name: '镜像源', exact: true })).toBeVisible({
      timeout: 45000,
    });
  };
  await page.goto('/');
  await openSettings();
  const mirror = page.getByLabel('游戏数据镜像', { exact: true });
  const original = await mirror.isChecked();
  await mirror.setChecked(!original);
  const categories = page.getByRole('navigation', { name: '设置分类' });
  await categories.getByRole('button', { name: 'FGA', exact: true }).click();
  for (const name of ['战斗与停止条件', '助战选择', '识别与匹配', '操作与等待', '截图、录屏与调试'])
    await expect(page.getByRole('group', { name, exact: true })).toBeVisible();
  await categories.getByRole('button', { name: 'Chaldea', exact: true }).click();
  await expect(mirror).toBeChecked({ checked: !original });
  await page.getByRole('button', { name: '保存 Chaldea 设置', exact: true }).click();
  await expect(page.getByText('已保存到 Chaldea', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/chaldea-settings.png', fullPage: true });
  await page.reload();
  await openSettings();
  await expect(mirror).toBeChecked({ checked: !original });
  await mirror.setChecked(original);
  await page.getByRole('button', { name: '保存 Chaldea 设置', exact: true }).click();
  await expect(page.getByText('已保存到 Chaldea', { exact: true })).toBeVisible();
});

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
  await expect
    .poll(() => frame.locator('body').evaluate(() => location.pathname))
    .toBe('/chaldea/');
  const semantics = frame.locator('flt-semantics-placeholder');
  if (await semantics.count()) await semantics.press('Enter');
  await expect(frame.locator('flt-semantics')).not.toHaveCount(0, { timeout: 30000 });
  console.log('Chaldea semantics:', await frame.locator('body').innerText());
  await page.screenshot({ path: 'test-results/chaldea-module.png', fullPage: true });
  await page.getByRole('tab', { name: '全局设置', exact: true }).click();
  await page
    .getByRole('navigation', { name: '设置分类' })
    .getByRole('button', { name: '主框架', exact: true })
    .click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.getByRole('tab', { name: 'Chaldea', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await frame
    .locator('body')
    .evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  await page.screenshot({ path: 'test-results/chaldea-module-dark.png', fullPage: true });
  await frame.getByRole('button', { name: '下一页', exact: true }).click();
  // Flutter PageView's 300ms transition must finish before another nextPage call.
  await page.waitForTimeout(350);
  await expect(frame.getByRole('group', { name: '选择语言', exact: true })).toBeVisible();
  await frame.getByRole('button', { name: '下一页', exact: true }).click();
  // Flutter PageView's 300ms transition must finish before another nextPage call.
  await page.waitForTimeout(350);
  await expect(frame.getByRole('textbox')).toBeVisible();
  await frame.getByRole('button', { name: '下一页', exact: true }).click();
  // Flutter PageView's 300ms transition must finish before another nextPage call.
  await page.waitForTimeout(350);
  await expect(frame.getByRole('group', { name: '数据库', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/chaldea-database-onboarding.png', fullPage: true });
  await frame.getByRole('button', { name: '完成', exact: true }).click();
  await expect(
    frame.locator('flt-semantics').getByText('数据库未下载，请重试。', { exact: true }),
  ).toBeVisible();
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
