<template>
  <div
    ref="previewRef"
    class="flex flex-wrap"
    :class="[showDots ? 'gap-1 pt-3' : 'gap-2 pt-3.5 pb-0.5']"
  >
    <template v-if="showDots">
      <div
        v-for="peer in peers"
        :key="peer.id"
        class="flex size-3 items-center justify-center rounded-sm transition hover:scale-110"
        :class="peer.online ? 'bg-low-latency' : 'bg-base-content/60'"
        @mouseenter="(e) => makeTippy(e, peer)"
        @click.stop="$emit('peerclick', peer)"
      >
        <!-- same white pip regular groups use to mark the selected node -->
        <div
          v-if="now && exitNodeValue(peer) === now"
          class="size-[5px] rounded-[2px] bg-white"
        ></div>
      </div>
    </template>
    <div
      v-else
      class="flex flex-1 items-center justify-center overflow-hidden rounded-2xl *:h-2"
    >
      <div
        class="bg-low-latency"
        :style="{ width: barWidth(onlineCount) }"
      />
      <div
        class="bg-base-content/60"
        :style="{ width: barWidth(peers.length - onlineCount) }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * Mirrors ProxyPreview for tailnet peers. They carry no latency, so the dots
 * and the bar read online state instead of a latency bucket.
 */
import { exitNodeValue, peerLabel } from '@/composables/tailscale'
import { PROXY_PREVIEW_TYPE } from '@/constant'
import { useTooltip } from '@/helper/tooltip'
import { proxyPreviewType } from '@/store/settings'
import type { TailscalePeer } from '@/types'
import { useElementSize } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps<{
  peers: TailscalePeer[]
  /** Exit node currently in use, as the core reports it. */
  now?: string
}>()

defineEmits<{ (e: 'peerclick', peer: TailscalePeer): void }>()

const { showTip } = useTooltip()
const previewRef = ref<HTMLElement | null>(null)
const { width } = useElementSize(previewRef)

const widthEnough = computed(() => width.value > 16 * props.peers.length)

const showDots = computed(
  () =>
    proxyPreviewType.value === PROXY_PREVIEW_TYPE.DOTS ||
    (proxyPreviewType.value === PROXY_PREVIEW_TYPE.AUTO && widthEnough.value),
)

const onlineCount = computed(() => props.peers.filter((peer) => peer.online).length)

const barWidth = (count: number) =>
  props.peers.length ? `${(count * 100) / props.peers.length}%` : '0%'

const makeTippy = (e: Event, peer: TailscalePeer) => {
  const tag = document.createElement('div')
  const name = document.createElement('div')

  name.textContent = peerLabel(peer)
  tag.append(name)

  const detail = document.createElement('div')
  detail.textContent = peer.online ? (peer.ips?.[0] ?? '') : t('offline')
  detail.classList.add('opacity-60')
  tag.append(detail)

  tag.classList.add('flex', 'items-center', 'gap-2')
  showTip(e, tag)
}
</script>
