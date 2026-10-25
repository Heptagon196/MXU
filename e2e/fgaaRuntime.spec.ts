import { test, expect, type WebSocketRoute } from '@playwright/test';
import { createFgaInterface } from '../src/fgaa/taskInterface';
import zh from '../src/i18n/locales/fgaa-zh-CN';

test('production event batches render localized runtime state through MXU WebSocket', async ({
  page,
}) => {
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket('**/api/ws', (ws) => {
    socket = ws;
  });
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
      'mxu-config-FGAA',
      JSON.stringify({
        version: '1.0',
        instances: [{ id: 'runtime-fixture', name: '运行测试', tasks: [] }],
        settings: { language: 'zh-CN' },
        lastActiveInstanceId: 'runtime-fixture',
      }),
    );
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
  await expect
    .poll(() =>
      page.evaluate(() => {
        const config = JSON.parse(localStorage.getItem('mxu-config-FGAA') ?? '{}');
        return config.instances?.[0]?.id ?? null;
      }),
    )
    .not.toBeNull();
  const instanceId = await page.evaluate(
    () => JSON.parse(localStorage.getItem('mxu-config-FGAA')!).instances[0].id as string,
  );
  await expect.poll(() => Boolean(socket)).toBe(true);
  const runId = '12345678-1234-1234-1234-123456789abc';
  const event = (name: string, sequence: number, payload: object) =>
    JSON.stringify({
      protocol: 1,
      event: name,
      sequence,
      payload,
      runId,
      nativeTaskId: 5,
      time: '2026-10-26T00:00:00Z',
    });
  const send = (line: string) =>
    socket!.send(
      JSON.stringify({
        type: 'maa-agent-output',
        payload: { instance_id: instanceId, stream: 'stdout', line },
      }),
    );
  send(event('started', 1, { taskId: '友情池测试', mode: 'FP' }));
  const status = page.getByRole('region', { name: 'FGA 任务状态' });
  await expect(status.getByText('运行中', { exact: true })).toBeVisible();
  send(
    [
      event('notify', 2, { code: 'BetweenRuns', runs: 4, refills: 2, ceDrops: 1 }),
      event('finished', 3, { status: 'attention', reason: 'inventory_full', details: {} }),
    ].join('\n'),
  );
  await expect(status.getByText('需要处理', { exact: true })).toBeVisible();
  await expect(status.getByText('背包已满', { exact: true })).toBeVisible();
  await status.getByText('运行记录（1）', { exact: true }).click();
  await expect(
    status.getByText('完成 4 轮，补充 2 次，礼装掉落 1 张', { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/fgaa-runtime.png', fullPage: true });
  await page.getByRole('tab', { name: '全局设置', exact: true }).click();
  await expect(status).toBeHidden();
  await page.getByRole('tab', { name: '自动化', exact: true }).click();
  await expect(status.getByText('背包已满', { exact: true })).toBeVisible();
});
