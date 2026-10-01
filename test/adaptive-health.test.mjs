import assert from 'node:assert/strict'
import { adaptiveLatency } from '../src/helper/adaptive-health.ts'

const now = Date.now()
const result = {
  ok: true,
  at: new Date(now).toISOString(),
  probes: [
    { ok: true, ms: 120 },
    { ok: true, ms: 240 },
  ],
}
assert.equal(adaptiveLatency(result, now), 240)
assert.equal(adaptiveLatency({ ...result, ok: false }, now), 0)
assert.equal(adaptiveLatency({ ...result, probes: [{ ok: false, ms: 120 }] }, now), 0)
assert.equal(adaptiveLatency(result, now + 600_001), 0)
assert.equal(adaptiveLatency(undefined, now), 0)
console.log('Adaptive GET latency: fresh, partial, failed, stale and missing cases passed')
