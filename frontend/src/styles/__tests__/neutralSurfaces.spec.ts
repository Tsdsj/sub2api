import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { compileStyle, parse } from 'vue/compiler-sfc'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../../../tailwind.config.js'

const source = (path: string) => readFileSync(resolve(process.cwd(), 'src', path), 'utf8')
const styles = (path: string) => parse(source(path)).descriptor.styles.map((style) => style.content).join('\n')

describe('non-table neutral skin surfaces', () => {
  it('uses shared tokens for onboarding panels, borders, foregrounds, and matching arrows', () => {
    const css = postcss.parse(source('styles/onboarding.css'))
    const value = (selector: string, property: string) => {
      let found: string | undefined
      css.walkRules(selector, (rule) => rule.walkDecls(property, (decl) => { found = decl.value }))
      return found
    }
    expect(value('.driver-popover.theme-tour-popover', 'background-color'))
      .toBe('rgb(var(--color-surface-panel, 255 255 255))')
    expect(value('.dark .driver-popover.theme-tour-popover', 'background-color'))
      .toBe('rgb(var(--color-dark-800, 30 41 59))')
    for (const side of ['left', 'right', 'top', 'bottom']) {
      for (const prefix of ['', '.dark ']) {
        expect(value(`${prefix}.driver-popover-arrow-side-${side}.driver-popover-arrow`, `border-${side}-color`))
          .toBe(value(`${prefix}.driver-popover.theme-tour-popover`, 'background-color'))
      }
    }
    css.walkDecls((decl) => {
      if (/^(color|background-color|border(?:-(?:top|right|bottom|left))?(?:-color)?)$/.test(decl.prop)) {
        // Keep the high-contrast action foreground fixed, just like text-white.
        if (decl.parent?.type === 'rule' && decl.parent.selector === '.theme-tour-popover .driver-popover-next-btn' && decl.prop === 'color') {
          expect(decl.value).toBe('#ffffff')
        } else if (decl.value !== 'transparent' && decl.value !== 'none' && !decl.value.endsWith(' transparent')) {
          expect(decl.value).toContain('var(--color-')
        }
      }
    })
  })

  it('themes neutral scrollbar gradients, dividers, and loading skeletons', () => {
    for (const file of [
      'components/common/AnnouncementBell.vue', 'components/common/AnnouncementPopup.vue',
      'components/layout/AppSidebar.vue', 'views/KeyUsageView.vue'
    ]) {
      const css = postcss.parse(styles(file))
      css.walkDecls(/^(background|background-color)$/, (decl) => {
        if (decl.value !== 'transparent') expect(decl.value).toContain('var(--color-')
      })
    }
    const globalCss = source('style.css')
    expect(globalCss).toContain('scrollbar-color: rgb(var(--color-gray-400, 156 163 175) / 0.5) transparent')
    expect(globalCss).toContain('scrollbar-color: rgb(var(--color-gray-600, 75 85 99) / 0.5) transparent')
    expect(source('views/KeyUsageView.vue')).toContain('rgb(var(--color-dark-800, 34 34 34))')
    expect(source('views/KeyUsageView.vue')).toContain('rgb(var(--color-gray-100, 240 240 238))')
  })

  it('keeps the dark skeleton gradient scoped to its element after Vue compilation', () => {
    const compiled = compileStyle({ source: styles('views/KeyUsageView.vue'), filename: 'KeyUsageView.vue', id: 'data-v-skin-test', scoped: true })
    expect(compiled.errors).toEqual([])
    const selectors: string[] = []
    postcss.parse(compiled.code).walkRules((rule) => { selectors.push(rule.selector) })
    expect(selectors).toContain('.dark .skeleton[data-v-skin-test]')
    expect(selectors).not.toContain('.dark')
  })
})

describe('endpoint tooltip skin utilities', () => {
  let css: string
  beforeAll(async () => {
    css = (await postcss([tailwindcss({
      ...tailwindConfig, content: [{ raw: source('components/keys/EndpointPopover.vue'), extension: 'vue' }]
    })]).process('@tailwind utilities;', { from: undefined })).css
  })

  it('preserves exact slate/white fallbacks and alpha while routing chrome through shared tokens', () => {
    for (const value of [
      '--color-surface-panel, 255 255 255', '--color-dark-200, 226 232 240',
      '--color-dark-600, 71 85 105', '--color-dark-700, 51 65 85', '--color-dark-900, 15 23 42'
    ]) expect(css).toContain(value)
    expect(css).toContain('rgb(var(--color-dark-200, 226 232 240) / 0.8)')
    expect(css).toContain('rgb(var(--color-dark-700, 51 65 85) / 0.7)')
    expect(css).toContain('0 14px 36px -20px rgb(var(--color-dark-900,15 23 42)/0.35)')
    expect(source('components/keys/EndpointPopover.vue')).not.toMatch(/(?:bg|border|ring|text)-slate-/)
    expect(source('components/keys/EndpointPopover.vue')).not.toContain('bg-white')
  })

  it('retains tooltip positioning and visibility utilities', () => {
    expect(css).toContain('--tw-translate-x: -50%')
    expect(css).toContain('--tw-translate-y: 0px')
    expect(css).toContain('group-focus-within')
    expect(css).toContain('group-hover')
    expect(css).not.toContain('<alpha-value>')
  })
})
