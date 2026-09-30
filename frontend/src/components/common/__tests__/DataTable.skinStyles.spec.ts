import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { parse, compileStyle } from 'vue/compiler-sfc'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../../../../tailwind.config.js'
import { SKIN_PRESETS, skinVariables, type SkinPreset } from '@/config/skins'
import DataTable from '../DataTable.vue'
import source from '../DataTable.vue?raw'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const filename = 'DataTable.vue'
const descriptor = parse(source, { filename }).descriptor
const scopeId = (DataTable as unknown as { __scopeId: string }).__scopeId
let css: string
let style: HTMLStyleElement
let wrapper: VueWrapper | undefined

beforeAll(async () => {
  expect(scopeId).toMatch(/^data-v-/)
  // Compile the real SFC selectors, including Vue's scope attributes, and load
  // them AFTER the real Tailwind utilities: this is the override that regressed.
  const utilities = await postcss([tailwindcss({
    ...tailwindConfig,
    content: [{ raw: source }]
  })]).process('@tailwind utilities;', { from: undefined })
  const componentStyles = descriptor.styles.map((block) => {
    const result = compileStyle({ source: block.content, filename, id: scopeId, scoped: block.scoped })
    expect(result.errors).toEqual([])
    return result.code
  }).join('\n')
  const rules = postcss.parse(`${utilities.css}\n${componentStyles}`)
  // jsdom does not expose a pointer's :hover state. Keep the compiled selectors,
  // replacing only that pseudo-class with an explicit test interaction state.
  rules.walkRules((rule) => { rule.selector = rule.selector.replace(/:hover/g, '.simulate-hover') })
  css = rules.toString()
})

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  style = document.createElement('style')
  document.head.append(style)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  style.remove()
  document.documentElement.classList.remove('dark')
})

// jsdom cannot resolve custom properties. Substitute ONLY the runtime token
// values, then let its CSSOM match the actual scoped selectors and compute the
// winning backgrounds. Literal overrides therefore fail instead of being hidden
// by a test that merely checks whether token strings exist somewhere in a file.
function applySkin(preset: SkinPreset, dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  const variables: Record<string, string> = {
    '--tw-bg-opacity': '1', '--tw-border-opacity': '1', '--tw-text-opacity': '1',
    ...(preset.id === 'default' ? {} : skinVariables(preset))
  }
  let resolved = css
  for (let pass = 0; pass < 3; pass++) {
    resolved = resolved.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g,
      (match, key: string, fallback: string | undefined) => variables[key] ?? fallback ?? match)
  }
  style.textContent = resolved
}

function render(props: Record<string, unknown> = {}) {
  wrapper = mount(DataTable, {
    attachTo: document.body,
    props: {
      columns: [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'value', label: 'Value' },
        { key: 'actions', label: 'Actions' }
      ],
      data: [{ id: 1, name: 'Example', value: 'content', actions: 'Edit' }],
      rowKey: 'id',
      ...props
    }
  })
  return wrapper
}

const rgb = (channels: string) => `rgb(${channels.split(' ').join(', ')})`
const background = (selector: string) => getComputedStyle(wrapper!.get(selector).element).backgroundColor

for (const dark of [false, true]) {
  describe(dark ? 'dark table surfaces' : 'light table surfaces', () => {
    it.each(SKIN_PRESETS)('$id colors header and both opaque sticky columns after scoped CSS overrides', async (preset) => {
      applySkin(preset, dark)
      const view = render()
      const expectedHeader = rgb(dark
        ? preset.id === 'default' ? '31 41 55' : preset.surfaces.dark[800]
        : preset.surfaces.gray[50])
      const expectedCell = rgb(dark
        ? preset.id === 'default' ? '17 24 39' : preset.surfaces.dark[900]
        : preset.surfaces.panel)
      expect(background('thead')).toBe(expectedHeader)
      for (const th of view.findAll('thead th')) expect(getComputedStyle(th.element).backgroundColor).toBe(expectedHeader)
      expect(background('tbody .sticky-col-left')).toBe(expectedCell)
      expect(background('tbody .sticky-col-right')).toBe(expectedCell)
      expect(getComputedStyle(view.get('tbody .sticky-col-right').element).position).toBe('sticky')

      view.element.classList.add('is-scrollable')
      view.element.scrollLeft = 80
      await view.trigger('scroll')
      expect(background('tbody .sticky-col-left')).toBe(expectedCell)
      expect(background('tbody .sticky-col-right')).toBe(expectedCell)
      view.get('tbody tr').element.classList.add('simulate-hover')
      expect(background('tbody .sticky-col-left')).toBe(expectedHeader)
      expect(background('tbody .sticky-col-right')).toBe(expectedHeader)
    })
  })
}

it('keeps header themed for empty/loading tables and changes/reset skins without remounting', async () => {
  const view = render({ data: [] })
  for (const preset of [...SKIN_PRESETS, SKIN_PRESETS[0]!]) {
    applySkin(preset, true)
    expect(background('thead th')).toBe(rgb(preset.id === 'default' ? '31 41 55' : preset.surfaces.dark[800]))
    await view.setProps({ loading: true })
    expect(background('thead')).toBe(background('thead th'))
    await view.setProps({ loading: false })
  }
})

it('composes selection over opaque pinned cells and applies the same overlay on hover', async () => {
  applySkin(SKIN_PRESETS[3]!, true)
  const view = render({ selectable: true, selectedKeys: [1] })
  const row = view.get('tbody tr[data-row-id="1"]')
  expect(row.classes()).toContain('table-row-selected')
  const pinned = view.get('tbody .sticky-col-right').element
  expect(getComputedStyle(pinned).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  const selectedOverlay = getComputedStyle(pinned).backgroundImage
  expect(selectedOverlay).toContain('linear-gradient')
  expect(selectedOverlay).toBe(getComputedStyle(row.element).backgroundImage)
  row.element.classList.add('simulate-hover')
  expect(getComputedStyle(pinned).backgroundImage).toBe(selectedOverlay)
  await view.setProps({ selectedKeys: [] })
  expect(getComputedStyle(pinned).backgroundImage).not.toContain('linear-gradient')
})


it('detects the original high-specificity literal override as a regression', () => {
  const preset = SKIN_PRESETS[3]!
  applySkin(preset, true)
  render()
  const themedHeader = background('thead')
  style.textContent += `\n.dark .table-wrapper .table-header[${scopeId}] { background-color: rgb(31 41 55); }`
  expect(background('thead')).toBe('rgb(31, 41, 55)')
  expect(background('thead')).not.toBe(themedHeader)
})
