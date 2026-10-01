<template>
  <CollapseCard :name="item">
    <template v-slot:title>
      <div class="flex w-full items-center gap-2 pr-1">
        <span class="truncate text-base font-medium">{{ proxyName }}</span>
        <span class="text-base-content/60 shrink-0 text-xs tracking-tight uppercase">
          {{ $t('tailscaleDevices') }}
        </span>
        <span
          v-if="status"
          class="text-base-content/60 shrink-0 text-xs"
        >
          {{ onlineCount }}/{{ status.peers.length }}
        </span>
        <span class="flex-1" />
        <span
          v-if="loading"
          class="loading loading-spinner loading-xs shrink-0"
        />
        <button
          v-else
          class="btn btn-circle btn-xs"
          @click.stop="fetchTailscaleStatus(proxyName)"
        >
          <ArrowPathIcon class="h-3 w-3" />
        </button>
      </div>
    </template>

    <template v-slot:preview>
      <TailscalePreview
        :peers="status?.peers ?? []"
        :now="status?.exitNode"
      />
    </template>

    <template v-slot:content>
      <div
        v-if="error"
        class="alert alert-error mb-2 text-xs"
      >
        {{ error }}
      </div>
      <div
        v-else-if="loading && !status"
        class="text-base-content/60 text-xs"
      >
        {{ $t('tailscaleLoading') }}
      </div>
      <div
        v-else-if="!status?.peers.length"
        class="text-base-content/60 text-xs"
      >
        {{ $t('tailscaleNoDevices') }}
      </div>
      <!-- Read-only: tailnet peers are not proxies, so there is nothing to ping. -->
      <div
        v-else
        class="grid gap-2"
        :style="gridStyle"
      >
        <div
          v-for="peer in status.peers"
          :key="peer.id"
          class="bg-base-200 flex flex-col items-start gap-1 rounded-md p-2"
        >
          <div class="flex w-full items-center gap-1">
            <span
              class="inline-block h-2 w-2 shrink-0 rounded-full"
              :class="peer.online ? 'bg-success' : 'bg-base-content/30'"
            />
            <span class="flex-1 truncate text-sm">{{ peerLabel(peer) }}</span>
            <span
              v-if="peer.exitNode"
              class="badge badge-primary badge-xs shrink-0"
              >{{ $t('tailscaleExitNode') }}</span
            >
            <span
              v-else-if="peer.exitNodeOption"
              class="badge badge-ghost badge-xs shrink-0"
              >{{ $t('tailscaleExitNodeCapable') }}</span
            >
          </div>
          <div class="text-base-content/60 w-full truncate text-xs tracking-tight">
            {{ peerDetails(peer) }}
          </div>
        </div>
      </div>
    </template>
  </CollapseCard>
</template>

<script setup lang="ts">
import CollapseCard from '@/components/common/CollapseCard.vue'
import TailscalePreview from './TailscalePreview.vue'
import {
  ensureTailscaleStatus,
  fetchTailscaleStatus,
  peerLabel,
  proxyNameOfItem,
  tailscaleError,
  tailscaleLoading,
  tailscaleStatus,
} from '@/composables/tailscale'
import { minProxyCardWidth } from '@/store/settings'
import type { TailscalePeer } from '@/types'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted } from 'vue'

const props = defineProps<{ name: string }>()

const item = computed(() => props.name)
const proxyName = computed(() => proxyNameOfItem(props.name))

const status = computed(() => tailscaleStatus(proxyName.value))
const loading = computed(() => tailscaleLoading(proxyName.value))
const error = computed(() => tailscaleError(proxyName.value))

const onlineCount = computed(() => status.value?.peers.filter((peer) => peer.online).length ?? 0)

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${minProxyCardWidth.value}px, 1fr))`,
}))

const peerDetails = (peer: TailscalePeer) =>
  [peer.ips?.[0], peer.os, peer.relay && `DERP ${peer.relay}`, peer.routes?.join(' ')]
    .filter(Boolean)
    .join(' · ')

onMounted(() => ensureTailscaleStatus(proxyName.value))
</script>
