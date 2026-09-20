<template>
  <DialogWrapper
    v-model="tailscaleModalOpen"
    :title="tailscaleTarget"
    box-class="max-w-160"
  >
    <div class="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto">
      <div
        v-if="loading && !status"
        class="flex items-center gap-2 py-6 text-sm"
      >
        <span class="loading loading-spinner loading-sm" />
        {{ $t('tailscaleLoading') }}
      </div>

      <div
        v-else-if="error"
        class="alert alert-error text-sm"
      >
        {{ error }}
      </div>

      <template v-else-if="status">
        <!-- backend state + exit node picker -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-base-content/60">{{ $t('tailscaleBackendState') }}</span>
            <span
              class="badge badge-sm"
              :class="status.backendState === 'Running' ? 'badge-success' : 'badge-warning'"
            >
              {{ status.backendState }}
            </span>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="text-base-content/60 text-sm">{{ $t('tailscaleExitNode') }}</span>
            <select
              v-model="selectedExitNode"
              class="select select-sm min-w-48 flex-1"
              :disabled="applying"
              @change="applyExitNode"
            >
              <option value="">{{ $t('tailscaleNoExitNode') }}</option>
              <option
                v-for="candidate in exitNodeCandidates"
                :key="candidate.id"
                :value="exitNodeValue(candidate)"
              >
                {{ peerLabel(candidate) }}{{ candidate.online ? '' : ` (${$t('offline')})` }}
              </option>
              <!-- keep a configured-but-unlisted node selectable -->
              <option
                v-if="configuredIsUnlisted"
                :value="status.exitNode"
              >
                {{ status.exitNode }}
              </option>
            </select>
            <span
              v-if="applying"
              class="loading loading-spinner loading-xs"
            />
            <span
              v-else-if="status.exitNodeActive"
              class="badge badge-success badge-sm"
              >{{ $t('tailscaleExitNodeActive') }}</span
            >
          </div>

          <div
            v-if="applyError"
            class="alert alert-error text-xs"
          >
            {{ applyError }}
          </div>
        </div>

        <div class="divider my-0" />

        <!-- devices -->
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">
            {{ $t('tailscaleDevices') }} ({{ status.peers.length }})
          </span>
          <button
            class="btn btn-xs"
            :disabled="loading"
            @click="load"
          >
            {{ $t('refresh') }}
          </button>
        </div>

        <div
          v-if="status.self"
          class="text-base-content/60 text-xs"
        >
          {{ $t('tailscaleSelf') }}: {{ peerLabel(status.self) }}
          <template v-if="status.self.ips?.length"> — {{ status.self.ips.join(', ') }}</template>
        </div>

        <div
          v-if="!status.peers.length"
          class="text-base-content/60 py-4 text-center text-sm"
        >
          {{ $t('tailscaleNoDevices') }}
        </div>
        <div
          v-else
          class="flex flex-col gap-1"
        >
          <div
            v-for="peer in status.peers"
            :key="peer.id"
            class="bg-base-200 flex flex-col gap-1 rounded-md p-2"
          >
            <div class="flex items-center gap-2">
              <span
                class="inline-block h-2 w-2 shrink-0 rounded-full"
                :class="peer.online ? 'bg-success' : 'bg-base-content/30'"
              />
              <span class="flex-1 truncate text-sm">{{ peerLabel(peer) }}</span>
              <span
                v-if="peer.exitNode"
                class="badge badge-primary badge-xs"
                >{{ $t('tailscaleExitNode') }}</span
              >
              <span
                v-else-if="peer.exitNodeOption"
                class="badge badge-ghost badge-xs"
                >{{ $t('tailscaleExitNodeCapable') }}</span
              >
            </div>
            <div class="text-base-content/60 flex flex-wrap gap-x-3 text-xs">
              <span v-if="peer.ips?.length">{{ peer.ips.join(', ') }}</span>
              <span v-if="peer.os">{{ peer.os }}</span>
              <span v-if="peer.relay">DERP: {{ peer.relay }}</span>
              <span v-if="peer.routes?.length">{{ peer.routes.join(', ') }}</span>
              <span v-if="!peer.online && peer.lastSeen">
                {{ $t('tailscaleLastSeen') }}: {{ formatLastSeen(peer.lastSeen) }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </DialogWrapper>
</template>

<script setup lang="ts">
import { fetchTailscaleStatusAPI, setTailscaleExitNodeAPI } from '@/assembly/proxies'
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import { closeTailscale, tailscaleModalOpen, tailscaleTarget } from '@/composables/tailscale'
import type { TailscalePeer, TailscaleStatus } from '@/types'
import { computed, ref, watch } from 'vue'

const status = ref<TailscaleStatus | null>(null)
const loading = ref(false)
const applying = ref(false)
const error = ref('')
const applyError = ref('')
const selectedExitNode = ref('')

/*
 * The core accepts an IP, a hostname or a MagicDNS name. Prefer the first
 * Tailscale IP: it is what the core can resolve while the backend is still
 * starting up, where hostnames are rejected.
 */
const exitNodeValue = (peer: TailscalePeer) => peer.ips?.[0] || peer.hostName

const peerLabel = (peer: TailscalePeer) => peer.dnsName || peer.hostName || peer.id

const exitNodeCandidates = computed(
  () => status.value?.peers.filter((peer) => peer.exitNodeOption) ?? [],
)

// A node configured in the config file may not be among the offered ones.
const configuredIsUnlisted = computed(() => {
  const configured = status.value?.exitNode
  if (!configured) return false
  return !exitNodeCandidates.value.some((peer) => exitNodeValue(peer) === configured)
})

const formatLastSeen = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const errorMessage = (e: unknown) => {
  const response = (e as { response?: { data?: { message?: string } } })?.response
  return response?.data?.message || (e as Error)?.message || String(e)
}

const load = async () => {
  if (!tailscaleTarget.value) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await fetchTailscaleStatusAPI(tailscaleTarget.value)
    status.value = data
    selectedExitNode.value = data.exitNode
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

const applyExitNode = async () => {
  applying.value = true
  applyError.value = ''
  const wanted = selectedExitNode.value
  try {
    await setTailscaleExitNodeAPI(tailscaleTarget.value, wanted)
    await load()
  } catch (e) {
    applyError.value = errorMessage(e)
    // Put the control back on what the core actually has.
    selectedExitNode.value = status.value?.exitNode ?? ''
  } finally {
    applying.value = false
  }
}

watch(
  () => tailscaleModalOpen.value,
  (isOpen) => {
    if (isOpen) {
      status.value = null
      error.value = ''
      applyError.value = ''
      load()
    } else {
      closeTailscale()
    }
  },
)
</script>
