import { ref } from 'vue'

// State for the single page-level provider editor modal.
export const providerEditorTarget = ref('')
export const providerEditorOpen = ref(false)

export const openProviderEditor = (providerName: string) => {
  providerEditorTarget.value = providerName
  providerEditorOpen.value = true
}

export const closeProviderEditor = () => {
  providerEditorOpen.value = false
  providerEditorTarget.value = ''
}
