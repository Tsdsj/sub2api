import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { DEFAULT_SKIN_ID, resolveSkin } from '@/config/skins'

export interface ChartThemeColors {
  grid: string
  text: string
  surface: string
  title: string
  body: string
}

interface ChartThemeDefaults {
  light?: Partial<ChartThemeColors>
  dark?: Partial<ChartThemeColors>
}

const DEFAULT_COLORS: Record<'light' | 'dark', ChartThemeColors> = {
  light: { grid: '#f3f4f6', text: '#6b7280', surface: '#ffffff', title: '#111827', body: '#4b5563' },
  dark: { grid: '#374151', text: '#9ca3af', surface: '#1f2937', title: '#f3f4f6', body: '#d1d5db' }
}

const rgb = (channels: string) => `rgb(${channels.split(' ').join(', ')})`

/**
 * Canvas needs concrete colors, not CSS var() expressions. Share the same preset
 * data as Tailwind and observe the existing root attributes so all legacy dark
 * toggles and cross-tab changes update mounted charts without a reload.
 */
export function useChartTheme(defaults: ChartThemeDefaults = {}) {
  const root = document.documentElement
  const isDark = ref(root.classList.contains('dark'))
  const skin = shallowRef(resolveSkin(root.dataset.skin))

  const observer = new MutationObserver(() => {
    isDark.value = root.classList.contains('dark')
    skin.value = resolveSkin(root.dataset.skin)
  })
  observer.observe(root, { attributes: true, attributeFilter: ['class', 'data-skin'] })
  onScopeDispose(() => observer.disconnect())

  const chartTheme = computed<ChartThemeColors>(() => {
    const mode = isDark.value ? 'dark' : 'light'
    if (skin.value.id === DEFAULT_SKIN_ID) {
      return { ...DEFAULT_COLORS[mode], ...defaults[mode] }
    }
    const { gray, dark, panel } = skin.value.surfaces
    return isDark.value
      ? { grid: rgb(dark[700]), text: rgb(dark[400]), surface: rgb(dark[800]), title: rgb(dark[100]), body: rgb(dark[300]) }
      : { grid: rgb(gray[100]), text: rgb(gray[500]), surface: rgb(panel), title: rgb(gray[900]), body: rgb(gray[600]) }
  })

  // Call inside a computed chart dataset/options value to subscribe to changes.
  // Error categories, health thresholds and categorical series do not use this.
  function accent(legacyColor: string, opacity?: number): string {
    if (skin.value.id === DEFAULT_SKIN_ID && opacity === undefined) return legacyColor
    const channels = skin.value.id === DEFAULT_SKIN_ID
      ? hexChannels(legacyColor)
      : skin.value.colors[isDark.value ? 400 : 500]
    if (!channels) return legacyColor
    return opacity === undefined
      ? rgb(channels)
      : `rgba(${channels.split(' ').join(', ')}, ${Math.min(1, Math.max(0, opacity))})`
  }

  return { isDark, chartTheme, accent }
}

function hexChannels(color: string): string | null {
  const match = /^#([\da-f]{6})(?:[\da-f]{2})?$/i.exec(color)
  if (!match) return null
  return [0, 2, 4].map((offset) => parseInt(match[1]!.slice(offset, offset + 2), 16)).join(' ')
}
