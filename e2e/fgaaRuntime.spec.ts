import { test, expect, type WebSocketRoute } from '@playwright/test';
import { createFgaInterface } from '../src/fgaa/taskInterface';
import zh from '../src/i18n/locales/fgaa-zh-CN';

test('queued FGA task parameters remain locked to the submitted snapshot', async ({ page }) => {
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
  await page.route('**/api/maa/state', (route) =>
    route.fulfill({
      json: {
        instances: {
          'queued-instance': {
            connected: true,
            resource_loaded: true,
            tasker_inited: true,
            is_running: true,
            task_run_state: {
              statuses: { 'queued-task': 'pending' },
              mappings: { '8': 'queued-task' },
              pending_task_ids: [8],
              current_task_index: 0,
              overall_status: 'running',
            },
          },
        },
        cached_adb_devices: [],
        cached_win32_windows: [],
        cached_wlroots_sockets: [],
        cached_gamescope_instances: [],
      },
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem('mxu-language', 'zh-CN');
    localStorage.setItem(
      'mxu-config-FGAA',
      JSON.stringify({
        version: '1.0',
        instances: [
          {
            id: 'queued-instance',
            name: '队列测试',
            tasks: [
              {
                id: 'queued-task',
                taskName: 'FGAA.FP',
                enabled: true,
                expanded: true,
                optionValues: {},
              },
            ],
          },
        ],
        settings: { language: 'zh-CN' },
        lastActiveInstanceId: 'queued-instance',
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: '跳过（DEV）', exact: true }).click();
  await expect(page.getByText(zh.queuedSnapshot, { exact: true })).toBeVisible();
  await expect(
    page.getByRole('switch', { name: '限制友情点召唤次数', exact: true }),
  ).toBeDisabled();
});

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
  const interrupted = '22345678-1234-1234-1234-123456789abc';
  send(
    JSON.stringify({
      ...JSON.parse(event('started', 1, { taskId: '中断测试', mode: 'FP' })),
      runId: interrupted,
    }),
  );
  await expect(status.getByText('运行中', { exact: true })).toBeVisible();
  socket!.send(
    JSON.stringify({
      type: 'maa-agent-output',
      payload: {
        instance_id: instanceId,
        stream: 'fgaa-output-closed',
        line: JSON.stringify({ runId: interrupted, nativeTaskId: 5 }),
      },
    }),
  );
  await expect(
    status.getByText('执行器输出已中断，未收到任务结束结果', { exact: true }),
  ).toBeVisible();
});
