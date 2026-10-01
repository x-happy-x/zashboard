<template>
  <CollapseCard :name="item">
    <template v-slot:title>
      <div class="flex w-full items-center gap-2 pr-1">
        <span class="truncate text-base font-medium">{{ proxyName }}</span>
        <span class="text-base-content/60 shrink-0 text-xs tracking-tight uppercase">
          {{ $t('tailscaleExitNodes') }}
        </span>
        <span
          v-if="status"
          class="badge badge-xs shrink-0"
          :class="status.backendState === 'Running' ? 'badge-success' : 'badge-warning'"
        >
          {{ status.backendState }}
        </span>
        <span class="flex-1" />
        <!-- Only reachable while the node is unregistered; the core drops the
             URL once the login goes through. -->
        <a
          v-if="status?.authURL"
          class="btn btn-warning btn-xs shrink-0"
          :href="status.authURL"
          target="_blank"
          rel="noopener noreferrer"
          @click.stop
        >
          {{ $t('tailscaleAuthorize') }}
        </a>
        <button
          v-if="status"
          class="btn btn-xs shrink-0"
          :class="status.wantRunning ? 'btn-ghost' : 'btn-success'"
          :disabled="applying"
          @click.stop="setTailscaleRunning(proxyName, !status.wantRunning)"
        >
          {{ status.wantRunning ? $t('tailscaleStop') : $t('tailscaleStart') }}
        </button>
        <span
          v-if="applying || loading"
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
        :peers="previewPeers"
        :now="status?.exitNode"
        @peerclick="select(exitNodeValue($event))"
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
        v-else
        class="grid gap-2"
        :style="gridStyle"
      >
        <button
          v-for="option in options"
          :key="option.value"
          :class="cardClass(option.value)"
          :disabled="applying"
          @click="select(option.value)"
        >
          <span class="w-full truncate text-sm">{{ option.label }}</span>
          <span class="flex w-full items-center gap-1 text-xs">
            <span
              v-if="option.value"
              class="inline-block h-2 w-2 shrink-0 rounded-full"
              :class="option.online ? 'bg-success' : 'bg-base-content/30'"
            />
            <span class="truncate tracking-tight opacity-60">{{ option.hint }}</span>
          </span>
        </button>
      </div>
    </template>
  </CollapseCard>
</template>

<script setup lang="ts">
import CollapseCard from '@/components/common/CollapseCard.vue'
import TailscalePreview from './TailscalePreview.vue'
import {
  configuredExitNodeIsUnlisted,
  exitNodeCandidates,
  exitNodeValue,
  fetchTailscaleStatus,
  peerLabel,
  proxyNameOfItem,
  setTailscaleExitNode,
  setTailscaleRunning,
  tailscaleApplying,
  tailscaleError,
  tailscaleLoading,
  tailscaleStatus,
  ensureTailscaleStatus,
} from '@/composables/tailscale'
import { minProxyCardWidth } from '@/store/settings'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps<{ name: string }>()

const item = computed(() => props.name)
const proxyName = computed(() => proxyNameOfItem(props.name))

const status = computed(() => tailscaleStatus(proxyName.value))
const loading = computed(() => tailscaleLoading(proxyName.value))
const applying = computed(() => tailscaleApplying(proxyName.value))
const error = computed(() => tailscaleError(proxyName.value))

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${minProxyCardWidth.value}px, 1fr))`,
}))

type Option = { value: string; label: string; hint: string; online: boolean }

const options = computed<Option[]>(() => {
  const result: Option[] = [
    { value: '', label: t('tailscaleNoExitNode'), hint: t('tailscaleDirectHint'), online: true },
  ]

  for (const peer of exitNodeCandidates(proxyName.value)) {
    result.push({
      value: exitNodeValue(peer),
      label: peerLabel(peer),
      hint: peer.ips?.[0] ?? '',
      online: peer.online,
    })
  }

  if (configuredExitNodeIsUnlisted(proxyName.value)) {
    const configured = status.value?.exitNode ?? ''
    result.push({
      value: configured,
      label: configured,
      hint: t('tailscaleNotOffered'),
      online: false,
    })
  }

  return result
})

// The preview shows the exit node candidates rather than every device: this
// card is the switcher, and a dot per tailnet peer would say nothing here.
const previewPeers = computed(() => exitNodeCandidates(proxyName.value))

// Ping is not offered here: an exit node is a tailnet peer, not a proxy the
// core can run a latency test against.
const cardClass = (value: string) => [
  'flex cursor-pointer flex-col items-start gap-1 rounded-md p-2 text-left disabled:cursor-not-allowed',
  value === (status.value?.exitNode ?? '')
    ? 'bg-primary/95 text-primary-content'
    : 'bg-base-200 sm:hover:bg-base-300/50',
]

const select = (value: string) => {
  if (applying.value || value === (status.value?.exitNode ?? '')) return
  setTailscaleExitNode(proxyName.value, value)
}

onMounted(() => ensureTailscaleStatus(proxyName.value))
</script>
