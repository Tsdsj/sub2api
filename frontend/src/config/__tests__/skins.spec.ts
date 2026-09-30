import { beforeAll, describe, expect, it } from 'vitest'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../../../tailwind.config.js'
import { DEFAULT_PRIMARY_COLORS } from '@/config/skins'

describe('skin CSS integration', () => {
  let css: string

  beforeAll(async () => {
    const result = await postcss([tailwindcss({
      ...tailwindConfig,
      content: [{
        raw: 'bg-primary-500/20 text-primary-600 dark:text-primary-400 bg-surface bg-surface-sidebar bg-white bg-gray-50 text-gray-900 dark:bg-dark-800 border-dark-700 bg-action-500 text-action-foreground bg-blue-500 bg-red-500 bg-gradient-primary bg-mesh-gradient bg-skin-grid shadow-glow shadow-glow-lg animate-glow'
      }]
    })]).process(`
      @tailwind utilities;
      .navigation-progress-test {
        background: linear-gradient(theme('colors.primary.400'), theme('colors.primary.500'));
      }
    `, { from: undefined })
    css = result.css
  })

  it('preserves original RGB defaults and Tailwind opacity modifiers', () => {
    expect(css).toContain(`rgb(var(--color-primary-500, ${DEFAULT_PRIMARY_COLORS[500]}) / 0.2)`)
    expect(css).toContain(`var(--color-primary-600, ${DEFAULT_PRIMARY_COLORS[600]})`)
    expect(css).toContain(`var(--color-primary-400, ${DEFAULT_PRIMARY_COLORS[400]})`)
    expect(css).toContain('dark\\:text-primary-400')
  })

  it('resolves theme() gradients without leaking alpha placeholders into CSS', () => {
    expect(css).not.toContain('<alpha-value>')
    expect(css).toContain('linear-gradient(rgb(var(--color-primary-400, 45 212 191) / 1), rgb(var(--color-primary-500, 20 184 166) / 1))')
  })

  it('themes shared surfaces and legacy interaction roles without overriding status or white', () => {
    const parsed = postcss.parse(css)
    const utility = (name: string) => parsed.nodes.find((node) => node.type === 'rule' && node.selector === `.${name}`)?.toString()
    expect(utility('bg-surface')).toContain('--color-surface-panel, 255 255 255')
    expect(utility('bg-surface-sidebar')).toContain('--color-surface-sidebar, 255 255 255')
    expect(utility('bg-gray-50')).toContain('--color-gray-50, 249 250 251')
    expect(utility('border-dark-700')).toContain('--color-dark-700, 51 65 85')
    expect(utility('bg-action-500')).toContain('--color-primary-500, 59 130 246')
    expect(utility('text-action-foreground')).toContain('--color-action-foreground')
    expect(utility('bg-white')).not.toContain('--color-')
    expect(utility('bg-blue-500')).not.toContain('--color-')
    expect(utility('bg-red-500')).not.toContain('--color-')
  })

  it('uses skin tokens for decorative gradients, glows and animation', () => {
    expect(css).toContain('--color-mesh-accent')
    for (const utility of ['bg-gradient-primary', 'bg-mesh-gradient', 'bg-skin-grid', 'shadow-glow', 'shadow-glow-lg']) {
      const rule = postcss.parse(css).nodes.find((node) => node.type === 'rule' && node.selector === `.${utility}`)
      expect(rule?.toString()).toContain('--color-primary-500')
    }
    const glow = postcss.parse(css).nodes.find((node) => node.type === 'atrule' && node.name === 'keyframes' && node.params === 'glow')
    expect(glow?.toString()).toContain('--color-primary-500')
  })
})
