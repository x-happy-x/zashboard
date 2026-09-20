<template>
  <DialogWrapper
    v-model="providerEditorOpen"
    :title="providerEditorTarget"
    box-class="max-w-160"
  >
    <div class="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
      <div
        v-if="error"
        class="alert alert-error text-xs"
      >
        {{ error }}
      </div>

      <!-- existing entries -->
      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium">{{ $t('providerEntries') }} ({{ entries.length }})</span>
        <div
          v-if="!entries.length"
          class="text-base-content/60 text-xs"
        >
          {{ $t('providerNoEntries') }}
        </div>
        <div
          v-for="entry in entries"
          :key="entry.name"
          class="bg-base-200 flex items-center gap-2 rounded-md p-2"
        >
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm">{{ entry.name }}</div>
            <div class="text-base-content/60 truncate text-xs tracking-tight">{{ entry.type }}</div>
          </div>
          <button
            class="btn btn-error btn-xs"
            :disabled="busy"
            @click="remove(entry.name)"
          >
            {{ $t('delete') }}
          </button>
        </div>
      </div>

      <div class="divider my-0" />

      <!-- add a new OLCRTC entry -->
      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium">{{ $t('providerAddOlcrtc') }}</span>

        <div class="grid gap-2 sm:grid-cols-2">
          <label class="form-control">
            <span class="label-text text-xs">{{ $t('providerFieldName') }}</span>
            <input
              v-model="form.name"
              class="input input-sm w-full"
              placeholder="OLC jitsi/datachannel"
            />
          </label>
          <label class="form-control">
            <span class="label-text text-xs">{{ $t('providerFieldProvider') }}</span>
            <select
              v-model="form.provider"
              class="select select-sm w-full"
            >
              <option
                v-for="p in PROVIDERS"
                :key="p"
                :value="p"
              >
                {{ p }}
              </option>
            </select>
          </label>
          <label class="form-control">
            <span class="label-text text-xs">{{ $t('providerFieldTransport') }}</span>
            <select
              v-model="form.transport"
              class="select select-sm w-full"
            >
              <option
                v-for="t in TRANSPORTS"
                :key="t"
                :value="t"
              >
                {{ t }}
              </option>
            </select>
          </label>
          <label class="form-control">
            <span class="label-text text-xs">{{ $t('providerFieldIdle') }}</span>
            <input
              v-model="form.idleTimeout"
              class="input input-sm w-full"
              placeholder="10m"
            />
          </label>
        </div>

        <label class="form-control">
          <span class="label-text text-xs">{{ $t('providerFieldRoom') }}</span>
          <input
            v-model="form.room"
            class="input input-sm w-full"
            placeholder="https://meet.example.org/room"
          />
        </label>

        <label class="form-control">
          <span class="label-text text-xs">{{ $t('providerFieldKey') }}</span>
          <input
            v-model="form.key"
            class="input input-sm w-full"
            placeholder="64 hex"
            autocomplete="off"
          />
        </label>

        <label class="form-control">
          <span class="label-text text-xs">{{ $t('providerFieldDns') }}</span>
          <input
            v-model="form.dns"
            class="input input-sm w-full"
            placeholder="127.0.0.1:1053"
          />
        </label>

        <!-- The core resolves through this; pointing it at a server reached
             through a proxy makes the tunnel depend on itself. -->
        <p class="text-base-content/60 text-xs">{{ $t('providerDnsHint') }}</p>

        <button
          class="btn btn-primary btn-sm"
          :disabled="busy || !canAdd"
          @click="add"
        >
          <span
            v-if="busy"
            class="loading loading-spinner loading-xs"
          />
          {{ $t('providerAdd') }}
        </button>
      </div>
    </div>
  </DialogWrapper>
</template>

<script setup lang="ts">
import { addProviderProxyAPI, deleteProviderProxyAPI, proxyProviederList } from '@/assembly/proxies'
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import {
  closeProviderEditor,
  providerEditorOpen,
  providerEditorTarget,
} from '@/composables/providerEditor'
import { fetchProxies } from '@/assembly/proxies'
import { computed, reactive, ref, watch } from 'vue'

const PROVIDERS = ['jitsi', 'telemost', 'wbstream']
const TRANSPORTS = ['datachannel', 'vp8channel', 'seichannel', 'videochannel']

const busy = ref(false)
const error = ref('')

const form = reactive({
  name: '',
  provider: 'jitsi',
  transport: 'datachannel',
  room: '',
  key: '',
  dns: '127.0.0.1:1053',
  idleTimeout: '10m',
})

// The provider list is the only source for what the file holds: the core
// deliberately does not hand out proxy settings, so entries are shown by name.
const entries = computed(
  () => proxyProviederList.value.find((p) => p.name === providerEditorTarget.value)?.proxies ?? [],
)

const canAdd = computed(() => Boolean(form.name && form.room && form.key))

const errorMessage = (e: unknown) => {
  const response = (e as { response?: { data?: { message?: string } } })?.response
  return response?.data?.message || (e as Error)?.message || String(e)
}

const refresh = async () => {
  await fetchProxies()
}

const add = async () => {
  busy.value = true
  error.value = ''
  try {
    await addProviderProxyAPI(providerEditorTarget.value, {
      name: form.name,
      type: 'olcrtc',
      'auth-provider': form.provider,
      transport: form.transport,
      'room-id': form.room,
      'encryption-key': form.key,
      ...(form.dns ? { 'dns-server': form.dns } : {}),
      ...(form.idleTimeout ? { 'idle-timeout': form.idleTimeout } : {}),
    })
    form.name = ''
    form.room = ''
    form.key = ''
    await refresh()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

const remove = async (name: string) => {
  busy.value = true
  error.value = ''
  try {
    await deleteProviderProxyAPI(providerEditorTarget.value, name)
    await refresh()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

watch(
  () => providerEditorOpen.value,
  (isOpen) => {
    if (isOpen) {
      error.value = ''
    } else {
      closeProviderEditor()
    }
  },
)
</script>
