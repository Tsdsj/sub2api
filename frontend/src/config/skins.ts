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

export const SKIN_PRESETS: readonly SkinPreset[] = [
  {
    id: 'default',
    nameKey: 'skinCenter.presets.default.name',
    descriptionKey: 'skinCenter.presets.default.description',
    colors: DEFAULT_PRIMARY_COLORS,
    meshAccent: '6 182 212'
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
    meshAccent: '14 165 233'
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
    meshAccent: '217 70 239'
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
    meshAccent: '244 114 182'
  }
]

export function resolveSkin(id: unknown): SkinPreset {
  return SKIN_PRESETS.find((skin) => skin.id === id) ?? SKIN_PRESETS[0]!
}
