<template>
  <section
    class="bg-base-200 mb-4 rounded-xl p-3 text-sm"
    data-testid="adaptive-health"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <strong>{{ $t('adaptiveHealth') }}</strong>
      <span
        class="badge badge-outline"
        :class="health.mode === 'whitelist' ? 'badge-warning' : ''"
      >
        {{ $t(labels[health.mode]) }}
      </span>
    </div>
    <p
      v-if="health.pending"
      class="text-warning mt-2 text-xs"
    >
      {{ $t('adaptiveConfirming') }}: {{ $t(labels[health.observed]) }} ({{ health.pending }})
    </p>
    <p class="text-base-content/60 mt-2 text-xs">{{ $t('adaptiveChecked') }}: {{ checkedAt }}</p>
    <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <span>{{ $t('adaptiveAllowed') }}: {{ passed(health.directAllowed) }}</span>
      <span>{{ $t('adaptiveGlobal') }}: {{ passed(health.directGlobal) }}</span>
    </div>
    <p
      v-if="health.persistenceError"
      class="text-error mt-2 text-xs"
    >
      {{ $t('adaptiveStorageError') }}
    </p>
    <div
      class="join mt-3"
      role="group"
      :aria-label="$t('adaptiveHistory')"
    >
      <button
        v-for="mode in modes"
        :key="mode"
        class="btn btn-xs join-item"
        :class="selected === mode ? 'btn-primary' : 'btn-ghost'"
        :aria-pressed="selected === mode"
        @click="selected = mode"
      >
        {{ $t(labels[mode]) }}
      </button>
    </div>
    <p class="text-base-content/60 my-2 text-xs">{{ $t('adaptiveHistoryHint') }}</p>
    <p
      v-if="!ranked.length"
      class="text-base-content/60 py-2"
    >
      {{ $t('adaptiveNoHistory') }}
    </p>
    <div
      v-else
      class="max-h-80 overflow-auto"
    >
      <table class="table-xs table w-full">
        <thead>
          <tr>
            <th>{{ $t('name') }}</th>
            <th>{{ $t('adaptiveSuccess') }}</th>
            <th>{{ $t('adaptiveChecks') }}</th>
            <th>ms</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="node in ranked"
            :key="node.name"
          >
            <td>
              <div class="space-y-1">
                <span
                  v-if="node.stable"
                  class="badge badge-success badge-xs"
                  >{{ $t('adaptiveStable') }}</span
                >
                <span class="block min-w-28 break-words">{{ node.name }}</span>
              </div>
              <details
                v-if="health.results[node.name]?.mode === selected"
                class="mt-1 text-xs"
              >
                <summary class="text-base-content/60 cursor-pointer">
                  {{ $t('adaptiveLastCheck') }}: {{ health.results[node.name].ok ? '✓' : '✕' }} ·
                  {{ formatTime(health.results[node.name].at) }}
                </summary>
                <div
                  v-for="(probe, index) in health.results[node.name].probes"
                  :key="index"
                  class="mt-1 break-all"
                  :class="probe.ok ? 'text-success' : 'text-error'"
                >
                  {{ probe.ok ? '✓' : '✕' }} {{ host(probe.url) }} · {{ probe.status || '—' }} ·
                  {{ probe.bytes }} B · {{ probe.ms }} ms
                  <span v-if="probe.error"> · {{ probe.error }}</span>
                </div>
              </details>
            </td>
            <td>{{ Math.round(node.successRate * 100) }}%</td>
            <td>{{ node.record.checks }}</td>
            <td>{{ Math.round(node.record.avgMs) || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup lang="ts">
import type { AdaptiveHealth, AdaptiveProbe } from '@/types'
import { computed, ref } from 'vue'
const props = defineProps<{ health: AdaptiveHealth }>()
const modes = ['normal', 'whitelist'] as const
const labels = {
  normal: 'adaptiveNormal',
  whitelist: 'adaptiveWhitelist',
  offline: 'adaptiveOffline',
  unknown: 'adaptiveUnknown',
} as const
const selected = ref<'normal' | 'whitelist'>(
  props.health.mode === 'whitelist' ? 'whitelist' : 'normal',
)
const ranked = computed(() => props.health.rankings[selected.value] ?? [])
const formatTime = (value: string) =>
  value && !value.startsWith('0001-') ? new Date(value).toLocaleString() : '—'
const checkedAt = computed(() => formatTime(props.health.checkedAt))
const passed = (probes: AdaptiveProbe[] | null) =>
  `${probes?.filter((p) => p.ok).length ?? 0}/${probes?.length ?? 0}`
const host = (url: string) => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
</script>
