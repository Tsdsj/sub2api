import { readdirSync, readFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse, compileStyle } from 'vue/compiler-sfc'
import postcss from 'postcss'
import { DEFAULT_GRAY_COLORS, DEFAULT_DARK_COLORS } from '@/config/skins'

const root = resolve(process.cwd(), 'src')
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__') return []
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? sources(path) : /\.(vue|css|ts)$/.test(entry.name) ? [path] : []
  })
}

const neutralChannels = new Set([...Object.values(DEFAULT_GRAY_COLORS), ...Object.values(DEFAULT_DARK_COLORS)])
const neutralHex = new Set([...neutralChannels].map((channels) => '#' + channels.split(' ').map((part) => Number(part).toString(16).padStart(2, '0')).join('')))

// Neutral "unknown" health indicators are part of the stable status scale.
const semanticNeutralSelectors = new Set(['.health-unknown'])

function rawNeutral(value: string): boolean {
  const withoutVariables = value.replace(/var\([^)]*\)/g, '')
  for (const match of withoutVariables.matchAll(/#[\da-f]{6}\b/gi)) {
    if (neutralHex.has(match[0].toLowerCase())) return true
  }
  for (const match of withoutVariables.matchAll(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/gi)) {
    if (neutralChannels.has(`${match[1]} ${match[2]} ${match[3]}`)) return true
  }
  return false
}

describe('theme coverage audit', () => {
  it('has no fixed gray/slate declarations bypassing tokens in application style blocks', () => {
    const omissions: string[] = []
    for (const file of sources(root).filter((file) => !file.endsWith('.ts'))) {
      const source = readFileSync(file, 'utf8')
      const blocks = file.endsWith('.vue') ? parse(source).descriptor.styles.map((block) => block.content) : [source]
      for (const block of blocks) {
        postcss.parse(block).walkDecls((declaration) => {
          const selector = declaration.parent?.type === 'rule' ? declaration.parent.selector : ''
          if (semanticNeutralSelectors.has(selector)) return
          if (rawNeutral(declaration.value)) {
            omissions.push(`${relative(root, file)}: ${selector} { ${declaration.prop}: ${declaration.value} }`)
          }
        })
      }
    }
    expect(omissions).toEqual([])
  })

  it('does not hide fixed neutral styles in template or translated inline HTML', () => {
    const omissions: string[] = []
    for (const file of sources(root)) {
      for (const match of readFileSync(file, 'utf8').matchAll(/(?<!:)\bstyle="([^"]*)"/g)) {
        if (rawNeutral(match[1]!)) omissions.push(`${relative(root, file)}: ${match[1]}`)
      }
    }
    expect(omissions).toEqual([])
  })

  it('keeps scoped dark selectors attached to their component instead of leaking onto the root', () => {
    const leaks: string[] = []
    for (const file of sources(root).filter((file) => file.endsWith('.vue'))) {
      for (const block of parse(readFileSync(file, 'utf8'), { filename: file }).descriptor.styles) {
        if (!block.scoped) continue
        const compiled = compileStyle({ source: block.content, filename: file, id: 'data-v-theme-audit', scoped: true })
        expect(compiled.errors, relative(root, file)).toEqual([])
        postcss.parse(compiled.code).walkRules((rule) => {
          if (rule.selectors.some((selector) => selector.trim() === '.dark' || selector.includes('[data-v-theme-audit] .dark'))) {
            leaks.push(`${relative(root, file)}: ${rule.toString()}`)
          }
        })
      }
    }
    expect(leaks).toEqual([])
  })
})
