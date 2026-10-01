import {
  fetchTailscaleStatusAPI,
  proxyMap,
  setTailscaleExitNodeAPI,
  setTailscaleRunningAPI,
} from '@/assembly/proxies'
import type { TailscalePeer, TailscaleStatus } from '@/types'
import { computed, ref } from 'vue'

/*
 * A Tailscale outbound is a single proxy entry, but it stands for a whole
 * tailnet. The proxies page shows its exit nodes as a group, and the provider
 * tab lists every device, so both views share one cached status per proxy.
 *
 * Synthetic page items are namespaced with these prefixes; the page dispatches
 * on them instead of looking the name up in proxyMap.
 */
export const TAILSCALE_EXIT_PREFIX = 'tailscale-exit:'
export const TAILSCALE_DEVICES_PREFIX = 'tailscale-devices:'

export const TAILSCALE_TYPE = 'tailscale'

export const isTailscaleProxy = (name: string) =>
  proxyMap.value[name]?.type?.toLowerCase() === TAILSCALE_TYPE

export const tailscaleProxyNames = computed(() =>
  Object.keys(proxyMap.value).filter(isTailscaleProxy).sort(),
)

export const tailscaleExitItems = computed(() =>
  tailscaleProxyNames.value.map((name) => TAILSCALE_EXIT_PREFIX + name),
)

export const tailscaleDeviceItems = computed(() =>
  tailscaleProxyNames.value.map((name) => TAILSCALE_DEVICES_PREFIX + name),
)

export const isTailscaleExitItem = (item: string) => item.startsWith(TAILSCALE_EXIT_PREFIX)
export const isTailscaleDevicesItem = (item: string) => item.startsWith(TAILSCALE_DEVICES_PREFIX)

export const proxyNameOfItem = (item: string) => item.slice(item.indexOf(':') + 1)

const statusMap = ref<Record<string, TailscaleStatus>>({})
const loadingMap = ref<Record<string, boolean>>({})
const errorMap = ref<Record<string, string>>({})
const applyingMap = ref<Record<string, boolean>>({})

export const tailscaleStatus = (name: string) => statusMap.value[name]
export const tailscaleLoading = (name: string) => Boolean(loadingMap.value[name])
export const tailscaleApplying = (name: string) => Boolean(applyingMap.value[name])
export const tailscaleError = (name: string) => errorMap.value[name] || ''

const errorMessage = (e: unknown) => {
  const response = (e as { response?: { data?: { message?: string } } })?.response
  return response?.data?.message || (e as Error)?.message || String(e)
}

export const fetchTailscaleStatus = async (name: string) => {
  if (loadingMap.value[name]) return

  loadingMap.value[name] = true
  errorMap.value[name] = ''
  try {
    const { data } = await fetchTailscaleStatusAPI(name)
    statusMap.value[name] = data
  } catch (e) {
    errorMap.value[name] = errorMessage(e)
  } finally {
    loadingMap.value[name] = false
  }
}

// Fetch once per proxy unless a refresh is asked for explicitly; the tailnet
// call starts the backend and is far heavier than the regular proxies poll.
export const ensureTailscaleStatus = (name: string) => {
  if (statusMap.value[name] || loadingMap.value[name]) return
  fetchTailscaleStatus(name)
}

export const setTailscaleExitNode = async (name: string, exitNode: string) => {
  applyingMap.value[name] = true
  errorMap.value[name] = ''
  try {
    await setTailscaleExitNodeAPI(name, exitNode)
  } catch (e) {
    errorMap.value[name] = errorMessage(e)
  } finally {
    applyingMap.value[name] = false
  }
  await fetchTailscaleStatus(name)
}

export const setTailscaleRunning = async (name: string, running: boolean) => {
  applyingMap.value[name] = true
  errorMap.value[name] = ''
  try {
    await setTailscaleRunningAPI(name, running)
  } catch (e) {
    errorMap.value[name] = errorMessage(e)
  } finally {
    applyingMap.value[name] = false
  }
  await fetchTailscaleStatus(name)
}

/*
 * The core resolves an exit node by IP, hostname or MagicDNS name. Prefer the
 * Tailscale IP: hostnames are rejected while the backend is still starting up.
 */
export const exitNodeValue = (peer: TailscalePeer) => peer.ips?.[0] || peer.hostName

export const peerLabel = (peer: TailscalePeer) =>
  peer.hostName || peer.dnsName || peer.ips?.[0] || peer.id

export const exitNodeCandidates = (name: string) =>
  statusMap.value[name]?.peers.filter((peer) => peer.exitNodeOption) ?? []

// An exit node named in the config file need not be among the offered peers,
// for instance while it is offline. Keep it selectable so the group does not
// silently show a different current value.
export const configuredExitNodeIsUnlisted = (name: string) => {
  const configured = statusMap.value[name]?.exitNode
  if (!configured) return false
  return !exitNodeCandidates(name).some((peer) => exitNodeValue(peer) === configured)
}
