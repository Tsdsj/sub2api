import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSwipeSelect } from '../useSwipeSelect'

const Harness = defineComponent({
  setup() {
    const container = ref<HTMLElement | null>(null)
    const selected = ref<number[]>([])
    const { isDragging } = useSwipeSelect(container, {
      isSelected: (id) => selected.value.includes(id),
      select: (id) => { if (!selected.value.includes(id)) selected.value.push(id) },
      deselect: (id) => { selected.value = selected.value.filter((value) => value !== id) },
    })
    return { container, selected, isDragging }
  },
  render() {
    return h('div', { ref: 'container' }, [h('table', [h('tbody', [
      h('tr', { 'data-row-id': '1' }, [h('td', 'First row')]),
    ])])])
  },
})

afterEach(() => {
  vi.restoreAllMocks()
  document.documentElement.classList.remove('dark')
  document.documentElement.style.removeProperty('--color-primary-400')
  document.documentElement.style.removeProperty('--color-primary-500')
})

describe('swipe selection skin tokens', () => {
  it.each([
    { dark: false, shade: 500, fallback: '59 130 246', fillAlpha: '0.12', borderAlpha: '0.4' },
    { dark: true, shade: 400, fallback: '96 165 250', fillAlpha: '0.15', borderAlpha: '0.5' },
  ])('themes the $dark-mode marquee while preserving selection and cleanup', async ({ dark, shade, fallback, fillAlpha, borderAlpha }) => {
    document.documentElement.classList.toggle('dark', dark)
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024)
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768)
    const wrapper = mount(Harness, { attachTo: document.body })
    const row = wrapper.get('tr')
    vi.spyOn(row.element, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 180, left: 0, right: 500, width: 500, height: 80, x: 0, y: 100,
      toJSON: () => ({}),
    })
    try {
      await wrapper.get('td').trigger('mousedown', { button: 0, clientX: 100, clientY: 120 })
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 140 }))
      expect(wrapper.vm.isDragging).toBe(true)
      expect(wrapper.vm.selected).toEqual([1])
      const marquee = Array.from(document.body.children).find((element) => (element as HTMLElement).style.position === 'fixed') as HTMLElement
      expect(marquee).toBeDefined()
      expect(marquee.style.background).toBe(`rgb(var(--color-primary-${shade}, ${fallback}) / ${fillAlpha})`)
      expect(marquee.style.border).toBe(`1.5px solid rgb(var(--color-primary-${shade}, ${fallback}) / ${borderAlpha})`)
      // Existing overlays keep their live CSS variable reference when the skin changes.
      document.documentElement.style.setProperty(`--color-primary-${shade}`, '135 78 238')
      expect(marquee.style.background).toContain(`var(--color-primary-${shade},`)
      document.dispatchEvent(new MouseEvent('mouseup'))
      expect(wrapper.vm.isDragging).toBe(false)
      expect(marquee.isConnected).toBe(false)
      expect(wrapper.vm.selected).toEqual([1])
    } finally {
      wrapper.unmount()
      wrapper.element.remove()
    }
  })
})
