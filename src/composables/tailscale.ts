import { ref } from 'vue'

// State for the single page-level tailnet modal.
export const tailscaleTarget = ref('')
export const tailscaleModalOpen = ref(false)

export const openTailscale = (proxyName: string) => {
  tailscaleTarget.value = proxyName
  tailscaleModalOpen.value = true
}

export const closeTailscale = () => {
  tailscaleModalOpen.value = false
  tailscaleTarget.value = ''
}
