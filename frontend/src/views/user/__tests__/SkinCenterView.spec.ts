import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SKIN_PRESETS, SKIN_STORAGE_KEY } from '@/config/skins'
import { useSkinStore } from '@/stores/skin'
import SkinCenterView from '@/views/user/SkinCenterView.vue'
import SkinPreview from '@/components/common/SkinPreview.vue'
import en from '@/i18n/locales/en/skinCenter'

vi.mock('@/components/layout/AppLayout.vue', () => ({
  default: { template: '<main><slot /></main>' }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, values: Record<string, string> = {}) => {
      const message = key.split('.').reduce<unknown>(
        (value, segment) => (value as Record<string, unknown>)[segment], en
      ) as string
      return message.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? `{${name}}`)
    }
  })
}))

describe('SkinCenterView', () => {
  let pinia: Pinia
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-skin')
    document.documentElement.classList.remove('dark')
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    wrapper?.unmount()
    useSkinStore(pinia).$dispose()
    vi.restoreAllMocks()
    localStorage.clear()
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-skin')
    document.documentElement.classList.remove('dark')
  })

  function render() {
    useSkinStore(pinia).initialize()
    wrapper = mount(SkinCenterView, { global: { plugins: [pinia] } })
    return wrapper
  }

  it('renders four named native radio choices with descriptions and decorative previews', () => {
    const view = render()
    const radios = view.findAll<HTMLInputElement>('input[type="radio"][name="skin"]')
    expect(radios).toHaveLength(4)
    expect(view.get('fieldset legend').text()).toBe(en.skinCenter.chooseSkin)
    expect(view.get('[role="status"]').text()).toBe('')

    for (const preset of SKIN_PRESETS) {
      const radio = view.get<HTMLInputElement>(`#skin-${preset.id}`)
      expect(radio.attributes('aria-labelledby')).toBe(`skin-${preset.id}-name`)
      expect(radio.attributes('aria-describedby')).toBe(`skin-${preset.id}-description`)
      expect(view.get(`label[for="skin-${preset.id}"]`).text()).toContain(
        en.skinCenter.presets[preset.id].name
      )
      expect(radio.element.checked).toBe(preset.id === 'default')
    }
    expect(view.findAllComponents(SkinPreview)).toHaveLength(4)
    expect(view.findAll('.skin-preview[aria-hidden="true"]')).toHaveLength(4)
    expect(view.get<HTMLButtonElement>('button').element.disabled).toBe(true)
  })

  it('applies a selection immediately and updates the checked state, selected label, and live status', async () => {
    const view = render()
    await view.get<HTMLInputElement>('#skin-ocean').setValue(true)

    expect(useSkinStore(pinia).selectedSkin).toBe('ocean')
    expect(localStorage.getItem(SKIN_STORAGE_KEY)).toBe('ocean')
    expect(document.documentElement.dataset.skin).toBe('ocean')
    expect(view.get<HTMLInputElement>('#skin-ocean').element.checked).toBe(true)
    expect(view.get<HTMLInputElement>('#skin-default').element.checked).toBe(false)
    expect(view.get('label[for="skin-ocean"]').text()).toContain(en.skinCenter.selected)
    expect(view.get('label[for="skin-default"]').text()).not.toContain(en.skinCenter.selected)
    expect(view.get('[role="status"]').text()).toBe('Ocean Blue applied.')
    expect(view.get<HTMLButtonElement>('button').element.disabled).toBe(false)
  })

  it('restores the default and supports selecting skins again after a reset', async () => {
    const view = render()
    await view.get<HTMLInputElement>('#skin-amethyst').setValue(true)
    await view.get('button').trigger('click')

    expect(useSkinStore(pinia).selectedSkin).toBe('default')
    expect(view.get<HTMLInputElement>('#skin-default').element.checked).toBe(true)
    expect(view.get('[role="status"]').text()).toBe(en.skinCenter.restored)
    expect(view.get<HTMLButtonElement>('button').element.disabled).toBe(true)

    await view.get<HTMLInputElement>('#skin-amethyst').setValue(true)
    await view.get<HTMLInputElement>('#skin-sunset').setValue(true)
    await view.get<HTMLInputElement>('#skin-amethyst').setValue(true)
    expect(view.findAll<HTMLInputElement>('input:checked').map((input) => input.element.value)).toEqual(['amethyst'])
    expect(view.get('[role="status"]').text()).toBe('Amethyst applied.')
  })

  it('updates selection and clears stale reset feedback when another tab changes the skin', async () => {
    const view = render()
    await view.get<HTMLInputElement>('#skin-ocean').setValue(true)
    await view.get('button').trigger('click')
    expect(view.get('[role="status"]').text()).toBe(en.skinCenter.restored)

    const event = new StorageEvent('storage', { key: SKIN_STORAGE_KEY, newValue: 'amethyst' })
    Object.defineProperty(event, 'storageArea', { value: localStorage })
    window.dispatchEvent(event)
    await nextTick()

    expect(view.get<HTMLInputElement>('#skin-amethyst').element.checked).toBe(true)
    expect(view.get<HTMLInputElement>('#skin-default').element.checked).toBe(false)
    expect(view.get('label[for="skin-amethyst"]').text()).toContain(en.skinCenter.selected)
    expect(view.get('[role="status"]').text()).toBe('Amethyst applied.')
    expect(view.get<HTMLButtonElement>('button').element.disabled).toBe(false)
  })

  it('keeps every preview palette isolated when the active skin changes and preserves dark mode', async () => {
    document.documentElement.classList.add('dark')
    const view = render()
    const previewStyles = view.findAllComponents(SkinPreview).map((preview) => preview.attributes('style'))
    expect(new Set(previewStyles).size).toBe(4)

    await view.get<HTMLInputElement>('#skin-sunset').setValue(true)
    expect(view.findAllComponents(SkinPreview).map((preview) => preview.attributes('style'))).toEqual(previewStyles)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    for (const [index, preset] of SKIN_PRESETS.entries()) {
      expect(view.findAll<HTMLElement>('.skin-preview')[index]?.element.style.getPropertyValue('--preview-primary-500')).toBe(preset.colors[500])
    }
  })

  it('reports a storage failure without blocking the selection and clears it after a successful change', async () => {
    const view = render()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    await view.get<HTMLInputElement>('#skin-ocean').setValue(true)

    expect(view.get<HTMLInputElement>('#skin-ocean').element.checked).toBe(true)
    expect(useSkinStore(pinia).selectedSkin).toBe('ocean')
    expect(view.get('[role="status"]').text()).toContain('Ocean Blue applied.')
    expect(view.get('[role="status"]').text()).toContain(en.skinCenter.persistenceError)

    setItem.mockRestore()
    await view.get<HTMLInputElement>('#skin-sunset').setValue(true)
    expect(view.get('[role="status"]').text()).toBe('Sunset applied.')
    expect(useSkinStore(pinia).persistenceError).toBe(false)
  })

  it('shows an initial persistence failure and leaves reset available for retrying', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    const view = render()
    expect(view.get('[role="status"]').text()).toBe(en.skinCenter.persistenceError)
    expect(view.get<HTMLButtonElement>('button').element.disabled).toBe(false)
  })
})
