import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { compileStyleAsync, parse } from 'vue/compiler-sfc'
import postcss, { type Root, type Rule } from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import tailwindConfig from '../../../tailwind.config.js'

const source = (path: string) => readFileSync(resolve(process.cwd(), 'src', path), 'utf8')
const scopeId = 'data-v-surface-test'

async function compileComponentStyles(path: string): Promise<Root> {
  const { descriptor } = parse(source(path), { filename: path })
  const compiled = await Promise.all(descriptor.styles.map(async (style) => {
    // Exercise the same CSS plugins as postcss.config.js, including @apply.
    const result = await compileStyleAsync({
      filename: path,
      source: style.content,
      id: scopeId,
      scoped: style.scoped,
      postcssPlugins: [tailwindcss({ ...tailwindConfig, content: [{ raw: '' }] }), autoprefixer()],
    })
    expect(result.errors).toEqual([])
    return result.code
  }))
  return postcss.parse(compiled.join('\n'))
}

function rulesFor(css: Root, selector: string): Rule[] {
  const matches: Rule[] = []
  css.walkRules((rule) => {
    if (rule.selectors.includes(selector)) matches.push(rule)
  })
  return matches
}

function declarations(css: Root, selector: string): string {
  const rules = rulesFor(css, selector)
  expect(rules.length, `Missing compiled selector ${selector}`).toBeGreaterThan(0)
  return rules.map((rule) => rule.toString()).join('\n')
}

function scoped(selector: string): string {
  return `${selector}[${scopeId}]`
}

describe('isolated component surface token coverage', () => {
  let settings: Root
  let matrix: Root
  let captcha: Root
  let concurrency: Root

  beforeAll(async () => {
    [settings, matrix, captcha, concurrency] = await Promise.all([
      compileComponentStyles('views/admin/SettingsView.vue'),
      compileComponentStyles('features/channel-monitor-v2/RelayPulseMatrix.vue'),
      compileComponentStyles('components/AliyunCaptchaWidget.vue'),
      compileComponentStyles('views/admin/ops/components/OpsConcurrencyCard.vue'),
    ])
  })

  it('keeps settings shell and hover gradients themed in both modes with exact original fallbacks', () => {
    expect(declarations(settings, scoped('.settings-tabs-shell'))).toContain('var(--color-surface-panel, 255 255 255) / 0.9')
    const hover = declarations(settings, `${scoped('.settings-tab')}::before`)
    expect(hover).toContain('rgb(var(--color-dark-50, 248 250 252) / 0.95)')
    expect(hover).toContain('rgb(var(--color-dark-100, 241 245 249) / 0.8)')
    const shellDark = declarations(settings, '.dark .settings-tabs-shell')
    expect(shellDark).toContain('rgb(var(--color-dark-700, 51 65 85) / 0.65)')
    expect(shellDark).toContain('rgb(var(--color-dark-900, 15 23 42) / 0.86)')
    const hoverDark = declarations(settings, '.dark .settings-tab::before')
    expect(hoverDark).toContain('rgb(var(--color-dark-800, 30 41 59) / 0.9)')
    expect(hoverDark).toContain('rgb(var(--color-dark-700, 51 65 85) / 0.62)')
  })

  it.each(['pulse-tooltip', 'matrix-floating-tooltip'])('themes %s chrome and preserves scoped dark targets through compilation', (name) => {
    const light = declarations(matrix, scoped(`.${name}`))
    expect(light).toContain('rgb(var(--color-gray-200, 229 231 235))')
    expect(light).toContain('rgb(var(--color-surface-panel, 255 255 255))')
    const dark = declarations(matrix, `.dark ${scoped(`.${name}`)}`)
    expect(dark).toContain('rgb(var(--color-gray-700, 55 65 81))')
    expect(dark).toContain('rgb(var(--color-gray-900, 17 24 39))')
    expect(dark).toContain('rgb(var(--color-gray-200, 229 231 235))')
    expect(declarations(matrix, scoped(`.${name}-line`))).toContain('rgb(var(--color-gray-600, 75 85 99))')
    expect(declarations(matrix, `.dark ${scoped(`.${name}-line`)}`)).toContain('rgb(var(--color-gray-300, 209 213 219))')
    expect(declarations(matrix, scoped(`.${name}-title`))).toContain('rgb(var(--color-gray-900, 17 24 39))')
    expect(declarations(matrix, `.dark ${scoped(`.${name}-title`)}`)).toContain('rgb(var(--color-gray-100, 243 244 246))')
    expect(rulesFor(matrix, '.dark')).toEqual([])
    expect(rulesFor(matrix, scoped('.dark'))).toEqual([])
  })

  it('leaves all matrix health and score colors semantic', () => {
    const expected = {
      'health-score10': '#16a34a', 'health-score9': '#22c55e', 'health-score8': '#4ade80',
      'health-score7': '#a3e635', 'health-score6': '#facc15', 'health-score5': '#fbbf24',
      'health-score4': '#f59e0b', 'health-score3': '#f97316', 'health-score2': '#fb7185',
      'health-score1': '#f87171', 'health-score0': 'rgb(239, 67, 67)',
      'health-healthy': '#22c55e', 'health-warning': '#f59e0b',
      'health-critical': '#ef4444', 'health-unknown': '#9ca3af',
    }
    for (const [name, color] of Object.entries(expected)) {
      const rule = declarations(matrix, scoped(`.${name}`))
      expect(rule).toContain(`background: ${color}`)
      expect(rule).not.toContain('--color-')
    }
  })

  it('themes captcha idle and hover chrome while retaining green verification states', () => {
    const base = declarations(captcha, scoped('.aliyun-captcha-button'))
    expect(base).toContain('var(--color-gray-300, 209 213 219)')
    expect(base).toContain('var(--color-gray-50, 249 250 251)')
    expect(base).toContain('var(--color-gray-700, 55 65 81)')
    const hover = declarations(captcha, `${scoped('.aliyun-captcha-button')}:hover:not(:disabled)`)
    expect(hover).toContain('var(--color-gray-400, 156 163 175)')
    expect(hover).toContain('var(--color-gray-100, 243 244 246)')
    const dark = declarations(captcha, `.dark ${scoped('.aliyun-captcha-button')}`)
    expect(dark).toContain('var(--color-gray-800, 31 41 55)')
    expect(dark).toContain('var(--color-gray-300, 209 213 219)')
    const darkHover = declarations(captcha, `.dark ${scoped('.aliyun-captcha-button')}:hover:not(:disabled)`)
    expect(darkHover).toContain('var(--color-gray-600, 75 85 99)')
    expect(darkHover).toContain('var(--color-gray-700, 55 65 81)')
    const verified = declarations(captcha, scoped('.aliyun-captcha-button--verified'))
    expect(verified).toContain('rgb(34 197 94)')
    expect(verified).toContain('rgb(240 253 244)')
    expect(verified).toContain('rgb(21 128 61)')
    expect(verified).not.toContain('--color-')
    const darkVerified = declarations(captcha, `.dark ${scoped('.aliyun-captcha-button--verified')}`)
    expect(darkVerified).toContain('rgb(20 83 45 / 0.3)')
    expect(darkVerified).toContain('rgb(134 239 172)')
    expect(darkVerified).not.toContain('--color-')
  })

  it('uses neutral tokens for standard and WebKit concurrency scrollbars', () => {
    expect(declarations(concurrency, scoped('.custom-scrollbar'))).toContain('scrollbar-color: rgb(var(--color-gray-400, 156 163 175) / 0.3) transparent')
    expect(declarations(concurrency, `${scoped('.custom-scrollbar')}::-webkit-scrollbar-thumb`)).toContain('rgb(var(--color-gray-400, 156 163 175) / 0.3)')
    expect(declarations(concurrency, `${scoped('.custom-scrollbar')}::-webkit-scrollbar-thumb:hover`)).toContain('rgb(var(--color-gray-400, 156 163 175) / 0.5)')
  })

  it('uses matching slate fallbacks for payment page surfaces without changing provider or status colors', async () => {
    const popup = source('views/user/StripePopupView.vue')
    const template = parse(popup).descriptor.template!.content
    const { css } = await postcss([tailwindcss({ ...tailwindConfig, content: [{ raw: template }] })]).process('@tailwind utilities;', { from: undefined })
    expect(template).toContain('bg-dark-50')
    expect(template).toContain('dark:bg-dark-950')
    expect(template).toContain('bg-surface')
    expect(template).toContain('dark:bg-dark-900')
    expect(template).not.toMatch(/(?:bg|border|text)-slate-/)
    for (const fallback of ['--color-dark-50, 248 250 252', '--color-dark-950, 2 6 23', '--color-dark-200, 226 232 240', '--color-dark-700, 51 65 85', '--color-dark-900, 15 23 42', '--color-dark-400, 148 163 184', '--color-surface-panel, 255 255 255']) {
      expect(css).toContain(fallback)
    }
    expect(popup).toContain("alipay: '#00AEEF'")
    expect(popup).toContain("wechat_pay: '#07C160'")
    expect(popup).toContain("DEFAULT_METHOD_COLOR = '#635bff'")
    expect(template).toContain('text-green-600 dark:text-green-400')
    expect(template).toContain('border-red-200 bg-red-50')
  })
})
