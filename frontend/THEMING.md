# Frontend skin tokens

Skins are personal, browser-local appearance preferences. They do not alter site
branding, authentication, API settings, data meaning, or the separate light/dark
preference. The original skin keeps the existing CSS fallback colors.

## One data model, shared components

`frontend/src/config/skins.ts` is the source of truth:

- `colors`: the primary 50–950 accent ramp
- `surfaces`: neutral light/dark ramps plus light panel and sidebar surfaces
- `meshAccent`: the secondary decorative background accent
- `skinVariables()`: the single mapping from preset data to CSS custom properties

Non-default surfaces use one shared tonal-scale generator with a preset hue.
The store applies the variables to the document before mounting. Reset removes
all overrides, including surface variables. Preview cards reuse the exact same
mapping in a local scope, so selecting a skin cannot recolor the other previews.
There are no per-preset component templates or per-preset CSS selectors.

## Choose a color by its role

- `primary-*`: the application's existing teal interaction role; the fallback
  remains teal, while selected skins supply their own primary palette
- `action-*`: legacy blue interaction controls, such as operational actions,
  time-range buttons and drilldown links; the fallback remains blue
- `action-foreground` / `action-hover`: legacy blue-500/600 foregrounds that need
  lighter accents on dark surfaces; their original fallback remains unchanged
- `surface` / `surface-sidebar`: panel and sidebar backgrounds; use these instead
  of `bg-white` for themed UI surfaces. Keep `text-white` for white button labels
- `gray-*` / `dark-*`: existing neutral utilities consume the shared surface ramp,
  covering backgrounds, foregrounds, borders, hover states and input controls

All palettes support Tailwind opacity modifiers. A component should select a
semantic role once, not branch on the selected skin. New components can reuse the
existing `card`, `input`, `dropdown`, dialog and layout classes.

## Colors that retain their meaning

Do not replace every blue, green or red utility mechanically. Keep these stable:

- Success, warning, error, health thresholds and alert severity
- Provider/platform identity colors and logos
- Categorical chart series, including request versus upstream errors and TPS
  versus QPS; a themed principal series must remain distinct from the others

Decorative heading icons, primary trend lines, selected controls and navigation
are appearance roles and should follow the skin.

## Canvas charts

Canvas cannot resolve CSS custom properties. Use `useChartTheme()` inside Vue
setup and consume its values inside computed chart data/options:

- `chartTheme` provides actual colors for grid, text and tooltip surfaces
- `accent(originalColor, optionalOpacity)` themes a principal/decorative series
  while keeping its original fallback
- Optional `light` / `dark` defaults preserve a chart's previous neutral colors

The helper observes the existing root `class` and `data-skin` attributes. Both
legacy light/dark controls and cross-tab skin changes therefore refresh mounted
charts; no new dark-mode state store or duplicated chart is needed.

## Adding a preset

Add its data in `skins.ts`, extend `SkinId`, and add matching English/Chinese
labels. Do not edit individual components or introduce a skin-specific stylesheet.
Check primary action contrast, neutral text contrast in both modes, and distinct
chart categories. The skin-store, CSS integration and chart tests are included
in the frontend test suite; the central skin tests also run in `make test-frontend`.

Run `make test-frontend`, the full frontend Vitest suite, and the frontend build.
When a browser preview is available, additionally check same-tab switching,
reload/reset, dark-mode switching, keyboard selection and narrow layouts.
