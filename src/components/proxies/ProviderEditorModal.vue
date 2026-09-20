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
          v-if="loading && !entries.length"
          class="text-base-content/60 text-xs"
        >
          {{ $t('tailscaleLoading') }}
        </div>
        <div
          v-else-if="!entries.length"
          class="text-base-content/60 text-xs"
        >
          {{ $t('providerNoEntries') }}
        </div>
        <div
          v-for="entry in entries"
          :key="String(entry.name)"
          class="bg-base-200 flex items-center gap-2 rounded-md p-2"
          :class="editing === entry.name && 'ring-primary ring-1'"
        >
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm">{{ entry.name }}</div>
            <div class="text-base-content/60 truncate text-xs tracking-tight">
              {{ entryDetails(entry) }}
            </div>
          </div>
          <button
            class="btn btn-xs"
            :disabled="busy"
            @click="startEdit(entry)"
          >
            {{ $t('edit') }}
          </button>
          <button
            class="btn btn-error btn-xs"
            :disabled="busy"
            @click="remove(String(entry.name))"
          >
            {{ $t('delete') }}
          </button>
        </div>
      </div>

      <div class="divider my-0" />

      <!-- add or edit -->
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">
            {{ editing ? $t('providerEditEntry') : $t('providerAddOlcrtc') }}
          </span>
          <button
            v-if="editing"
            class="btn btn-ghost btn-xs"
            @click="cancelEdit"
          >
            {{ $t('cancel') }}
          </button>
        </div>

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
            :placeholder="editing ? $t('providerKeyUnchanged') : '64 hex'"
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
          :disabled="busy || !canSubmit"
          @click="submit"
        >
          <span
            v-if="busy"
            class="loading loading-spinner loading-xs"
          />
          {{ editing ? $t('save') : $t('providerAdd') }}
        </button>
      </div>
    </div>
  </DialogWrapper>
</template>

<script setup lang="ts">
import {
  addProviderProxyAPI,
  deleteProviderProxyAPI,
  fetchProviderProxiesAPI,
  fetchProxies,
  updateProviderProxyAPI,
} from '@/assembly/proxies'
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import {
  closeProviderEditor,
  providerEditorOpen,
  providerEditorTarget,
} from '@/composables/providerEditor'
import { computed, reactive, ref, watch } from 'vue'

const PROVIDERS = ['jitsi', 'telemost', 'wbstream']
const TRANSPORTS = ['datachannel', 'vp8channel', 'seichannel', 'videochannel']

type Entry = Record<string, unknown>

const entries = ref<Entry[]>([])
const busy = ref(false)
const loading = ref(false)
const error = ref('')
// Name of the entry being edited; empty means the form adds a new one.
const editing = ref('')

const form = reactive({
  name: '',
  provider: 'jitsi',
  transport: 'datachannel',
  room: '',
  key: '',
  dns: '127.0.0.1:1053',
  idleTimeout: '10m',
})

// The key is never sent back by the core, so an edit can go ahead without it
// and the stored one is kept.
const canSubmit = computed(
  () => Boolean(form.name && form.room) && (Boolean(editing.value) || Boolean(form.key)),
)

const entryDetails = (entry: Entry) =>
  [entry['auth-provider'], entry.transport, entry['room-id']].filter(Boolean).join(' · ')

const errorMessage = (e: unknown) => {
  const response = (e as { response?: { data?: { message?: string } } })?.response
  return response?.data?.message || (e as Error)?.message || String(e)
}

const load = async () => {
  if (!providerEditorTarget.value) return
  loading.value = true
  try {
    const { data } = await fetchProviderProxiesAPI(providerEditorTarget.value)
    entries.value = data.proxies ?? []
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  editing.value = ''
  form.name = ''
  form.provider = 'jitsi'
  form.transport = 'datachannel'
  form.room = ''
  form.key = ''
  form.dns = '127.0.0.1:1053'
  form.idleTimeout = '10m'
}

const startEdit = (entry: Entry) => {
  editing.value = String(entry.name ?? '')
  form.name = String(entry.name ?? '')
  form.provider = String(entry['auth-provider'] ?? 'jitsi')
  form.transport = String(entry.transport ?? 'datachannel')
  form.room = String(entry['room-id'] ?? '')
  form.dns = String(entry['dns-server'] ?? '')
  form.idleTimeout = String(entry['idle-timeout'] ?? '')
  // Redacted by the core, so it starts blank and is only sent when retyped.
  form.key = ''
}

const cancelEdit = () => resetForm()

const submit = async () => {
  busy.value = true
  error.value = ''
  const payload: Record<string, unknown> = {
    name: form.name,
    type: 'olcrtc',
    'auth-provider': form.provider,
    transport: form.transport,
    'room-id': form.room,
    'dns-server': form.dns,
    'idle-timeout': form.idleTimeout,
  }
  if (form.key) {
    payload['encryption-key'] = form.key
  }

  try {
    if (editing.value) {
      await updateProviderProxyAPI(providerEditorTarget.value, editing.value, payload)
    } else {
      await addProviderProxyAPI(providerEditorTarget.value, payload)
    }
    resetForm()
    await load()
    await fetchProxies()
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
    if (editing.value === name) resetForm()
    await load()
    await fetchProxies()
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
      resetForm()
      entries.value = []
      load()
    } else {
      closeProviderEditor()
    }
  },
)
</script>
