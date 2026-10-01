import type { AdaptiveHealth } from '@/types'

type Result = AdaptiveHealth['results'][string]

// GET duration includes TLS and the required response body; it is not ICMP RTT.
export const adaptiveLatency = (result?: Result, now = Date.now()) => {
  if (!result?.ok || !result.probes.length || result.probes.some((p) => !p.ok)) return 0
  const age = now - Date.parse(result.at)
  if (!Number.isFinite(age) || age < -30_000 || age > 600_000) return 0
  return Math.max(1, ...result.probes.map((p) => p.ms))
}
