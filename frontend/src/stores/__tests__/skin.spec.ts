import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PRIMARY_COLORS, SKIN_PRESETS, SKIN_STORAGE_KEY, resolveSkin, skinVariables } from '@/config/skins'
import { useSkinStore } from '@/stores/skin'

function storageEvent(key: string | null, newValue: string | null, storageArea: Storage = localStorage) {
  const event = new StorageEvent('storage', { key, newValue })
  Object.defineProperty(event, 'storageArea', { value: storageArea })
  window.dispatchEvent(event)
}

describe('skin preference', () => {
  let store: ReturnType<typeof useSkinStore>

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-skin')
    document.documentElement.className = ''
    setActivePinia(createPinia())
    store = useSkinStore()
  })

  afterEach(() => {
    store.$dispose()
    vi.restoreAllMocks()
  })

  it.each([null, '', 'removed-preset', '__proto__'])('falls back to original colors for %s', (value) => {
    if (value !== null) localStorage.setItem(SKIN_STORAGE_KEY, value)
    store.initialize()
    expect(store.selectedSkin).toBe('default')
    expect(document.documentElement.dataset.skin).toBe('default')
    expect(document.documentElement.style.getPropertyValue('--color-primary-500')).toBe('')
    expect(store.persistenceError).toBe(false)
  })

  it.each(SKIN_PRESETS.map((skin) => skin.id))('restores %s synchronously before rendering', (id) => {
    localStorage.setItem(SKIN_STORAGE_KEY, id)
    store.initialize()
    expect(store.selectedSkin).toBe(id)
    expect(document.documentElement.dataset.skin).toBe(id)
    if (id !== 'default') {
      for (const [shade, color] of Object.entries(resolveSkin(id).colors)) {
        expect(document.documentElement.style.getPropertyValue(`--color-primary-${shade}`)).toBe(color)
      }
    }
  })

  it('applies every preset and saves only the chosen id', () => {
    store.initialize()
    for (const preset of SKIN_PRESETS) {
      store.setSkin(preset.id)
      expect(store.selectedSkin).toBe(preset.id)
      expect(localStorage.getItem(SKIN_STORAGE_KEY)).toBe(preset.id)
      expect(document.documentElement.dataset.skin).toBe(preset.id)
    }
    expect(localStorage.length).toBe(1)
  })

  it('applies the complete shared surface palette and updates it across tabs', () => {
    store.initialize()
    store.setSkin('sunset')
    for (const [property, value] of Object.entries(skinVariables(resolveSkin('sunset')))) {
      expect(document.documentElement.style.getPropertyValue(property)).toBe(value)
    }
    storageEvent(SKIN_STORAGE_KEY, 'amethyst')
    for (const [property, value] of Object.entries(skinVariables(resolveSkin('amethyst')))) {
      expect(document.documentElement.style.getPropertyValue(property)).toBe(value)
    }
  })

  it('restores default fallbacks while preserving unrelated inline styles', () => {
    document.documentElement.style.setProperty('--site-custom-color', 'red')
    store.initialize()
    store.setSkin('amethyst')
    store.resetSkin()
    for (const property of Object.keys(skinVariables(resolveSkin('default')))) {
      expect(document.documentElement.style.getPropertyValue(property)).toBe('')
    }
    expect(document.documentElement.style.getPropertyValue('--color-mesh-accent')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--site-custom-color')).toBe('red')
    expect(localStorage.getItem(SKIN_STORAGE_KEY)).toBe('default')
  })

  it.each(['light', 'dark'])('leaves existing %s mode untouched, including reset', (theme) => {
    localStorage.setItem('theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.add('custom-class')
    store.initialize()
    store.setSkin('ocean')
    store.resetSkin()
    expect(localStorage.getItem('theme')).toBe(theme)
    expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark')
    expect(document.documentElement.classList.contains('custom-class')).toBe(true)
  })

  it('keeps rendering when reading storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => store.initialize()).not.toThrow()
    expect(store.selectedSkin).toBe('default')
    expect(store.persistenceError).toBe(true)
  })

  it('applies in memory when writes fail and clears the warning on a successful retry', () => {
    store.initialize()
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    expect(() => store.setSkin('sunset')).not.toThrow()
    expect(store.selectedSkin).toBe('sunset')
    expect(document.documentElement.dataset.skin).toBe('sunset')
    expect(store.persistenceError).toBe(true)
    write.mockRestore()
    store.setSkin('sunset')
    expect(store.persistenceError).toBe(false)
    expect(localStorage.getItem(SKIN_STORAGE_KEY)).toBe('sunset')
  })

  it('normalizes an unexpected runtime id instead of injecting arbitrary CSS', () => {
    store.setSkin('url(javascript:alert(1))' as never)
    expect(store.selectedSkin).toBe('default')
    expect(localStorage.getItem(SKIN_STORAGE_KEY)).toBe('default')
  })

  it('synchronizes other tabs without writing preferences back', () => {
    store.initialize()
    const write = vi.spyOn(Storage.prototype, 'setItem')
    storageEvent(SKIN_STORAGE_KEY, 'amethyst')
    expect(store.selectedSkin).toBe('amethyst')
    expect(document.documentElement.dataset.skin).toBe('amethyst')
    expect(write).not.toHaveBeenCalled()
    storageEvent(SKIN_STORAGE_KEY, 'invalid')
    expect(store.selectedSkin).toBe('default')
    storageEvent(SKIN_STORAGE_KEY, 'ocean')
    storageEvent(SKIN_STORAGE_KEY, null)
    expect(store.selectedSkin).toBe('default')
    storageEvent(SKIN_STORAGE_KEY, 'sunset')
    storageEvent(null, null)
    expect(store.selectedSkin).toBe('default')
  })

  it('ignores unrelated keys and session storage', () => {
    store.initialize()
    store.setSkin('ocean')
    storageEvent('theme', 'dark')
    storageEvent(SKIN_STORAGE_KEY, 'sunset', sessionStorage)
    expect(store.selectedSkin).toBe('ocean')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('initializes once and removes its cross-tab listener when disposed', () => {
    const add = vi.spyOn(window, 'addEventListener')
    store.initialize()
    store.initialize()
    expect(add.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1)
    store.$dispose()
    storageEvent(SKIN_STORAGE_KEY, 'sunset')
    expect(store.selectedSkin).toBe('default')
  })
})

// The original theme remains unchanged. New presets use darker button stops to
// keep white action labels readable in both light and dark modes.
describe('skin palette contracts', () => {
  function luminance(rgb: string) {
    const [r, g, b] = rgb.split(' ').map((value) => {
      const channel = Number(value) / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }

  it('provides complete, valid RGB tokens and unique ids for every preset', () => {
    expect(new Set(SKIN_PRESETS.map((skin) => skin.id)).size).toBe(SKIN_PRESETS.length)
    for (const preset of SKIN_PRESETS) {
      expect(Object.keys(preset.colors)).toEqual(Object.keys(DEFAULT_PRIMARY_COLORS))
      for (const color of [...Object.values(preset.colors), preset.meshAccent]) {
        expect(color).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/)
        expect(color.split(' ').every((channel) => Number(channel) <= 255)).toBe(true)
      }
    }
  })

  it.each(SKIN_PRESETS)('$id surface text stays readable in both modes', (preset) => {
    const { gray, dark, panel, sidebar } = preset.surfaces
    const ratio = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
    expect(ratio(gray[500], panel)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(gray[700], sidebar)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(dark[400], dark[800])).toBeGreaterThanOrEqual(4.5)
    expect(ratio(dark[200], dark[900])).toBeGreaterThanOrEqual(4.5)
    expect(ratio(preset.colors[400], dark[800])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(SKIN_PRESETS)('$id terminal foreground meets 4.5:1 on the fixed dark surface', (preset) => {
    const foreground = preset.id === 'default' ? preset.colors[500] : preset.colors[400]
    expect((luminance(foreground) + 0.05) / (luminance('30 41 59') + 0.05)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(SKIN_PRESETS.filter((skin) => skin.id !== 'default'))('$id accent icons meet 3:1 on dark surfaces', (preset) => {
    expect((luminance(preset.colors[500]) + 0.05) / (luminance(preset.surfaces.dark[800]) + 0.05)).toBeGreaterThanOrEqual(3)
  })

  it.each(SKIN_PRESETS.filter((skin) => skin.id !== 'default'))('$id action colors meet 4.5:1 with white', (preset) => {
    for (const shade of [500, 600, 700] as const) {
      expect(1.05 / (luminance(preset.colors[shade]) + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
