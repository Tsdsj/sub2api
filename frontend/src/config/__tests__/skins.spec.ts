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
        raw: 'bg-primary-500/20 text-primary-600 dark:text-primary-400 bg-gradient-primary bg-mesh-gradient bg-skin-grid shadow-glow shadow-glow-lg animate-glow'
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
