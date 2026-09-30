export const SKIN_STORAGE_KEY = 'sub2api_skin'
export const DEFAULT_SKIN_ID = 'default'

export type SkinId = 'default' | 'ocean' | 'amethyst' | 'sunset'
export type SkinShade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950
export type SkinColors = Record<SkinShade, string>

export interface SkinPreset {
  id: SkinId
  nameKey: string
  descriptionKey: string
  /** RGB channels, shared by Tailwind's alpha-aware tokens and isolated previews. */
  colors: SkinColors
  meshAccent: string
  surfaces: SkinSurfaces
}

// Keep the original palette as the CSS fallback, including when JavaScript is unavailable.
export const DEFAULT_PRIMARY_COLORS: SkinColors = {
  50: '240 253 250',
  100: '204 251 241',
  200: '153 246 228',
  300: '94 234 212',
  400: '45 212 191',
  500: '20 184 166',
  600: '13 148 136',
  700: '15 118 110',
  800: '17 94 89',
  900: '19 78 74',
  950: '4 47 46'
}

export interface SkinSurfaces {
  gray: SkinColors
  dark: SkinColors
  panel: string
  sidebar: string
}

export const DEFAULT_GRAY_COLORS: SkinColors = {
  50: '249 250 251', 100: '243 244 246', 200: '229 231 235',
  300: '209 213 219', 400: '156 163 175', 500: '107 114 128',
  600: '75 85 99', 700: '55 65 81', 800: '31 41 55',
  900: '17 24 39', 950: '3 7 18'
}

export const DEFAULT_DARK_COLORS: SkinColors = {
  50: '248 250 252', 100: '241 245 249', 200: '226 232 240',
  300: '203 213 225', 400: '148 163 184', 500: '100 116 139',
  600: '71 85 105', 700: '51 65 85', 800: '30 41 59',
  900: '15 23 42', 950: '2 6 23'
}

export const DEFAULT_ACTION_COLORS: SkinColors = {
  50: '239 246 255', 100: '219 234 254', 200: '191 219 254',
  300: '147 197 253', 400: '96 165 250', 500: '59 130 246',
  600: '37 99 235', 700: '29 78 216', 800: '30 64 175',
  900: '30 58 138', 950: '23 37 84'
}

// One shared tonal scale gives every preset coherent canvas, panel, border and
// foreground colors. A new skin supplies data, never another set of components.
const SURFACE_TONES: Record<SkinShade, [number, number]> = {
  50: [0.65, 0.965], 100: [0.5, 0.94], 200: [0.4, 0.885],
  300: [0.3, 0.79], 400: [0.2, 0.6], 500: [0.16, 0.43],
  600: [0.2, 0.335], 700: [0.25, 0.26], 800: [0.35, 0.165],
  900: [0.4, 0.125], 950: [0.45, 0.07]
}

function hslChannels(hue: number, saturation: number, lightness: number): string {
  const amplitude = saturation * Math.min(lightness, 1 - lightness)
  return [0, 8, 4].map((offset) => {
    const k = (offset + hue / 30) % 12
    return Math.round(255 * (lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }).join(' ')
}

function tintedSurfaces(hue: number): SkinSurfaces {
  const ramp = Object.fromEntries(Object.entries(SURFACE_TONES).map(([shade, [saturation, lightness]]) => [
    shade, hslChannels(hue, saturation, lightness)
  ])) as SkinColors
  return {
    gray: ramp,
    dark: ramp,
    panel: hslChannels(hue, 0.6, 0.98),
    sidebar: hslChannels(hue, 0.55, 0.935)
  }
}

export const SKIN_PRESETS: readonly SkinPreset[] = [
  {
    id: 'default',
    nameKey: 'skinCenter.presets.default.name',
    descriptionKey: 'skinCenter.presets.default.description',
    colors: DEFAULT_PRIMARY_COLORS,
    meshAccent: '6 182 212',
    surfaces: { gray: DEFAULT_GRAY_COLORS, dark: DEFAULT_DARK_COLORS, panel: '255 255 255', sidebar: '255 255 255' }
  },
  {
    id: 'ocean',
    nameKey: 'skinCenter.presets.ocean.name',
    descriptionKey: 'skinCenter.presets.ocean.description',
    colors: {
      50: '239 246 255', 100: '219 234 254', 200: '191 219 254',
      300: '147 197 253', 400: '96 165 250', 500: '45 107 236',
      600: '29 78 216', 700: '30 64 175', 800: '30 58 138',
      900: '23 37 84', 950: '15 23 54'
    },
    meshAccent: '14 165 233',
    surfaces: tintedSurfaces(213)
  },
  {
    id: 'amethyst',
    nameKey: 'skinCenter.presets.amethyst.name',
    descriptionKey: 'skinCenter.presets.amethyst.description',
    colors: {
      50: '245 243 255', 100: '237 233 254', 200: '221 214 254',
      300: '196 181 253', 400: '167 139 250', 500: '135 78 238',
      600: '109 40 217', 700: '91 33 182', 800: '76 29 149',
      900: '59 23 110', 950: '35 14 68'
    },
    meshAccent: '217 70 239',
    surfaces: tintedSurfaces(270)
  },
  {
    id: 'sunset',
    nameKey: 'skinCenter.presets.sunset.name',
    descriptionKey: 'skinCenter.presets.sunset.description',
    colors: {
      50: '255 247 237', 100: '255 237 213', 200: '254 215 170',
      300: '253 186 116', 400: '251 146 60', 500: '200 76 18',
      600: '174 55 10', 700: '154 52 18', 800: '124 45 18',
      900: '100 37 16', 950: '67 20 7'
    },
    meshAccent: '244 114 182',
    surfaces: tintedSurfaces(25)
  }
]

export function resolveSkin(id: unknown): SkinPreset {
  return SKIN_PRESETS.find((skin) => skin.id === id) ?? SKIN_PRESETS[0]!
}

/** The only CSS-variable mapping, shared by the document and isolated previews. */
export function skinVariables(preset: SkinPreset): Record<string, string> {
  const variables: Record<string, string> = {
    '--color-mesh-accent': preset.meshAccent,
    '--color-surface-panel': preset.surfaces.panel,
    '--color-surface-sidebar': preset.surfaces.sidebar
  }
  for (const [family, palette] of Object.entries({
    primary: preset.colors,
    gray: preset.surfaces.gray,
    dark: preset.surfaces.dark
  })) {
    for (const [shade, value] of Object.entries(palette)) {
      variables[`--color-${family}-${shade}`] = value
    }
  }
  return variables
}
