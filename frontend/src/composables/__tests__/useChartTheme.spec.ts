import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, type EffectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { SKIN_STORAGE_KEY, resolveSkin } from '@/config/skins'
import { useSkinStore } from '@/stores/skin'
import { useChartTheme } from '@/composables/useChartTheme'

const root = document.documentElement
let scope: EffectScope

beforeEach(() => {
  root.className = ''
  root.removeAttribute('data-skin')
  root.removeAttribute('style')
  localStorage.clear()
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
  root.className = ''
  root.removeAttribute('data-skin')
  root.removeAttribute('style')
  vi.restoreAllMocks()
})

async function flushAttributes() {
  await Promise.resolve()
  await nextTick()
}

const rgb = (value: string) => `rgb(${value.split(' ').join(', ')})`

describe('useChartTheme', () => {
  it('preserves legacy defaults and returns concrete canvas colors without a store', () => {
    const theme = scope.run(() => useChartTheme())!
    expect(theme.chartTheme.value).toEqual({
      grid: '#f3f4f6', text: '#6b7280', surface: '#ffffff', title: '#111827', body: '#4b5563'
    })
    expect(theme.accent('#3b82f6')).toBe('#3b82f6')
    expect(theme.accent('#14b8a6', 0.2)).toBe('rgba(20, 184, 166, 0.2)')
  })

  it('applies chart-specific legacy defaults only for the original skin', async () => {
    const theme = scope.run(() => useChartTheme({
      light: { text: '#374151', grid: '#e5e7eb' },
      dark: { text: '#e5e7eb' }
    }))!
    expect(theme.chartTheme.value.text).toBe('#374151')
    root.classList.add('dark')
    await flushAttributes()
    expect(theme.chartTheme.value.text).toBe('#e5e7eb')
    root.dataset.skin = 'sunset'
    await flushAttributes()
    expect(theme.chartTheme.value.text).toBe(rgb(resolveSkin('sunset').surfaces.dark[400]))
    delete root.dataset.skin
    await flushAttributes()
    expect(theme.chartTheme.value.text).toBe('#e5e7eb')
  })

  it('reacts to repeated skin and legacy dark-mode changes without remounting', async () => {
    const theme = scope.run(() => {
      const tokens = useChartTheme()
      return { ...tokens, series: computed(() => tokens.accent('#3b82f6')) }
    })!
    for (const id of ['ocean', 'sunset', 'amethyst'] as const) {
      root.dataset.skin = id
      await flushAttributes()
      expect(theme.series.value).toBe(rgb(resolveSkin(id).colors[500]))
      expect(theme.chartTheme.value.surface).toBe(rgb(resolveSkin(id).surfaces.panel))
      root.classList.add('dark')
      await flushAttributes()
      expect(theme.isDark.value).toBe(true)
      expect(theme.series.value).toBe(rgb(resolveSkin(id).colors[400]))
      expect(theme.chartTheme.value.surface).toBe(rgb(resolveSkin(id).surfaces.dark[800]))
      root.classList.remove('dark')
      await flushAttributes()
    }
  })

  it('updates from cross-tab preferences and restores every chart token on reset', async () => {
    setActivePinia(createPinia())
    const store = useSkinStore()
    store.initialize()
    const theme = scope.run(() => useChartTheme())!
    const original = theme.chartTheme.value
    const event = new StorageEvent('storage', { key: SKIN_STORAGE_KEY, newValue: 'sunset' })
    Object.defineProperty(event, 'storageArea', { value: localStorage })
    window.dispatchEvent(event)
    await flushAttributes()
    expect(theme.chartTheme.value).not.toEqual(original)
    expect(theme.accent('#3b82f6')).toBe(rgb(resolveSkin('sunset').colors[500]))
    store.resetSkin()
    await flushAttributes()
    expect(theme.chartTheme.value).toEqual(original)
    expect(theme.accent('#3b82f6')).toBe('#3b82f6')
    store.$dispose()
  })

  it('falls back for an unknown preset and disconnects its observer with the owner', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    root.dataset.skin = 'unknown'
    const theme = scope.run(() => useChartTheme())!
    expect(theme.accent('#3b82f6')).toBe('#3b82f6')
    scope.stop()
    expect(disconnect).toHaveBeenCalledOnce()
    root.dataset.skin = 'ocean'
    root.classList.add('dark')
    await flushAttributes()
    expect(theme.isDark.value).toBe(false)
    expect(theme.accent('#3b82f6')).toBe('#3b82f6')
  })
})
