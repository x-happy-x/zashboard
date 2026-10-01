import assert from 'node:assert/strict'
import { sleep, waitFor } from './lib/cdp.mjs'
import { startHarness } from './lib/harness.mjs'

const harness = await startHarness({ groups: 4, nodes: 8 })
try {
  const now = new Date().toISOString()
  const summary = (name) => ({
    name,
    stable: true,
    successRate: 0.94,
    record: { checks: 18, avgMs: 142, lastCheck: now },
  })
  const probe = {
    url: 'https://example.org/',
    ok: true,
    status: 200,
    bytes: 4096,
    ms: 142,
    stage: 'complete',
  }
  harness.mock.providers['provider-0'].adaptive = {
    mode: 'whitelist',
    observed: 'whitelist',
    pending: 0,
    checkedAt: now,
    directAllowed: [probe],
    directGlobal: [{ ...probe, ok: false, status: 0, bytes: 0 }],
    rankings: {
      normal: [summary('Normal stable server')],
      whitelist: [summary('Whitelist stable server')],
    },
    results: {
      'Whitelist stable server': { mode: 'whitelist', at: now, ok: true, probes: [probe] },
    },
  }
  const page = await harness.openProxiesPage({
    settings: {
      'config/language': 'ru-RU',
      'cache/collapse-group-map': JSON.stringify({ 'provider-0': true, 'provider-1': true }),
    },
  })
  await page.evaluate(
    `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Провайдер')).click()`,
  )
  assert.notEqual(
    await waitFor(() =>
      page.evaluate(`!!document.querySelector('[data-testid="adaptive-health"]')`),
    ),
    null,
  )
  const text = () =>
    page.evaluate(`document.querySelector('[data-testid="adaptive-health"]').innerText`)
  assert.match(await text(), /Whitelist stable server/)
  assert.match(await text(), /Похоже на белые списки/)
  await page.evaluate(
    `document.querySelector('[data-testid="adaptive-health"] details').open = true`,
  )
  assert.match(await text(), /4096 B/)
  await page.screenshot('dist/adaptive-whitelist.png')
  await page.evaluate(
    `Array.from(document.querySelectorAll('[data-testid="adaptive-health"] button')).find(b => b.textContent.includes('Обычный')).click()`,
  )
  assert.notEqual(await waitFor(async () => (await text()).includes('Normal stable server')), null)
  assert.doesNotMatch(await text(), /Whitelist stable server/)
  assert.equal(
    await page.evaluate(`document.querySelectorAll('[data-testid="adaptive-health"]').length`),
    1,
  )
  await page.screenshot('dist/adaptive-normal.png')
  await page.call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  assert.notEqual(
    await waitFor(async () => (await text()).includes('Whitelist stable server')),
    null,
  )
  await sleep(1200)
  await page.screenshot('dist/adaptive-mobile.png')
  console.log('PASS: mode, distinct histories, GET details, legacy provider, desktop/mobile render')
} finally {
  await harness.close()
}
