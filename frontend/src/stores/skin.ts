import { onScopeDispose, readonly, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  DEFAULT_PRIMARY_COLORS,
  DEFAULT_SKIN_ID,
  SKIN_STORAGE_KEY,
  resolveSkin,
  type SkinId
} from '@/config/skins'

/** Personal appearance only: never changes the separate light/dark preference or site branding. */
export const useSkinStore = defineStore('skin', () => {
  const selectedSkin = ref<SkinId>(DEFAULT_SKIN_ID)
  const persistenceError = ref(false)
  let initialized = false

  function applySkin(id: unknown) {
    const preset = resolveSkin(id)
    selectedSkin.value = preset.id
    const root = document.documentElement
    root.dataset.skin = preset.id

    // Removing overrides restores the exact original Tailwind defaults.
    for (const shade of Object.keys(DEFAULT_PRIMARY_COLORS)) {
      const property = `--color-primary-${shade}`
      if (preset.id === DEFAULT_SKIN_ID) {
        root.style.removeProperty(property)
      } else {
        root.style.setProperty(property, preset.colors[Number(shade) as keyof typeof preset.colors])
      }
    }
    if (preset.id === DEFAULT_SKIN_ID) {
      root.style.removeProperty('--color-mesh-accent')
    } else {
      root.style.setProperty('--color-mesh-accent', preset.meshAccent)
    }
  }

  function setSkin(id: SkinId) {
    applySkin(id)
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, selectedSkin.value)
      persistenceError.value = false
    } catch {
      // Blocked storage must not prevent changing appearance for the current page.
      persistenceError.value = true
    }
  }

  function resetSkin() {
    setSkin(DEFAULT_SKIN_ID)
  }

  function handleStorage(event: StorageEvent) {
    // A null key is localStorage.clear(). Ignore sessionStorage and unrelated keys.
    if (event.key !== null && event.key !== SKIN_STORAGE_KEY) return
    try {
      if (event.storageArea !== localStorage) return
    } catch {
      return
    }
    applySkin(event.newValue)
    persistenceError.value = false
  }

  /** Called before mounting so every route starts with the saved skin. */
  function initialize() {
    if (initialized) return
    initialized = true
    try {
      applySkin(localStorage.getItem(SKIN_STORAGE_KEY))
    } catch {
      applySkin(DEFAULT_SKIN_ID)
      persistenceError.value = true
    }
    window.addEventListener('storage', handleStorage)
  }

  onScopeDispose(() => window.removeEventListener('storage', handleStorage))

  return {
    selectedSkin: readonly(selectedSkin),
    persistenceError: readonly(persistenceError),
    initialize,
    setSkin,
    resetSkin
  }
})
