import { test, expect } from '@playwright/test';

// Explicitly opt in: this exercises the real public dataset service, not fixtures.
test.use(
  process.env.FGAA_TEST_PROXY
    ? {
        proxy: { server: process.env.FGAA_TEST_PROXY, bypass: '127.0.0.1,localhost' },
      }
    : {},
);

test('embedded Chaldea downloads real data and completes onboarding', async ({ page }) => {
  test.skip(
    process.env.FGAA_CHALDEA_DOWNLOAD !== '1',
    'Requires network and a built Chaldea module',
  );
  test.setTimeout(240000);
  const failures: string[] = [];
  let downloads = 0;
  page.on('requestfailed', (request) => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname))
      failures.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  page.on('response', (response) => {
    if (['127.0.0.1', 'localhost'].includes(new URL(response.url()).hostname)) return;
    if (response.status() >= 400) failures.push(`${response.url()}: HTTP ${response.status()}`);
    else {
      downloads++;
      if (downloads % 20 === 0) console.log(`Chaldea external responses completed: ${downloads}`);
    }
  });
  await page.addInitScript(() => localStorage.setItem('mxu-language', 'zh-CN'));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Chaldea', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Chaldea"]');
  await expect(frame.locator('flt-glass-pane')).toBeAttached({ timeout: 60000 });
  const semantics = frame.locator('flt-semantics-placeholder');
  if (await semantics.count()) await semantics.press('Enter');
  for (let step = 0; step < 3; step++) {
    await frame.getByRole('button', { name: '下一页', exact: true }).click();
    await page.waitForTimeout(350); // Flutter PageView transition.
  }
  await expect(frame.getByRole('group', { name: '数据库', exact: true })).toBeVisible();
  try {
    const update = frame.getByRole('button', { name: '更新', exact: true });
    await update.click();
    await expect(update).toBeDisabled();
    await expect(update).toBeEnabled({ timeout: 180000 });
    await page.screenshot({ path: 'test-results/chaldea-downloaded.png', fullPage: true });
    await frame.getByRole('button', { name: '完成', exact: true }).click();
    await expect(frame.getByRole('group', { name: '数据库', exact: true })).toHaveCount(0);
    await expect(frame.getByText('/index.html Why you got here?', { exact: true })).toHaveCount(0);
    await expect(frame.getByText('404', { exact: true })).toHaveCount(0);
    await expect(frame.getByText('从者', { exact: true })).toBeVisible();
    await page.waitForTimeout(3000); // Allow dynamically requested CanvasKit fallback fonts to render.
    await page.screenshot({ path: 'test-results/chaldea-home.png', fullPage: true });
  } finally {
    console.log('Chaldea download:', { downloads, failures });
    console.log('Chaldea page:', await frame.locator('body').innerText());
    await page.screenshot({ path: 'test-results/chaldea-download-result.png', fullPage: true });
  }
});
