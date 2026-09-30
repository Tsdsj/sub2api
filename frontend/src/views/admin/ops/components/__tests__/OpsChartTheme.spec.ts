import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, type Component } from 'vue'
import OpsThroughputTrendChart from '../OpsThroughputTrendChart.vue'
import OpsSwitchRateTrendChart from '../OpsSwitchRateTrendChart.vue'
import OpsLatencyChart from '../OpsLatencyChart.vue'
import OpsErrorTrendChart from '../OpsErrorTrendChart.vue'
import OpsErrorDistributionChart from '../OpsErrorDistributionChart.vue'

// The shared composable owns DOM/token reading. These tests verify its reactive
// results reach existing charts without remounts, while semantic series stay put.
const theme = reactive({ selected: false, dark: false })
const chartTheme = computed(() => ({
  grid: theme.selected ? '#eadbcd' : theme.dark ? '#374151' : '#f3f4f6',
  text: theme.selected ? '#92735c' : theme.dark ? '#9ca3af' : '#6b7280',
  surface: theme.selected ? '#faf2e9' : theme.dark ? '#1f2937' : '#ffffff',
  title: theme.selected ? '#251a10' : theme.dark ? '#f3f4f6' : '#111827',
  body: theme.selected ? '#685343' : theme.dark ? '#d1d5db' : '#4b5563',
}))

vi.mock('@/composables/useChartTheme', () => ({
  useChartTheme: (defaults: { light?: Record<string, string>; dark?: Record<string, string> } = {}) => ({
    isDark: computed(() => theme.dark),
    chartTheme: computed(() => theme.selected
      ? chartTheme.value
      : { ...chartTheme.value, ...defaults[theme.dark ? 'dark' : 'light'] }),
    accent: (fallback: string, opacity?: number) => {
      const color = theme.selected ? (theme.dark ? '#fb923c' : '#f97316') : fallback
      if (opacity === undefined) return color
      const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16))
      return `rgba(${rgb.join(', ')}, ${opacity})`
    },
  }),
}))

vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('vue-chartjs', async () => {
  const { defineComponent } = await import('vue')
  const chart = (name: string) => defineComponent({
    name,
    props: ['data', 'options'],
    template: '<div class="chart-stub" />',
  })
  return { Line: chart('Line'), Bar: chart('Bar'), Doughnut: chart('Doughnut') }
})

const global = { stubs: { HelpTooltip: true, EmptyState: true } }
const points = [{
  bucket_start: '2026-09-30T00:00:00Z', request_count: 10,
  token_consumed: 1000, qps: 2, tps: 200, switch_count: 2,
}]
const trendProps = { points, timeRange: '1h', loading: false }
const latencyProps = {
  loading: false,
  latencyData: {
    start_time: '2026-09-30T00:00:00Z', end_time: '2026-09-30T01:00:00Z',
    platform: '', total_requests: 10, buckets: [{ range: '0-100', count: 10 }],
  },
}

beforeEach(() => {
  theme.selected = false
  theme.dark = false
})

describe('Ops chart skin integration', () => {
  it.each([
    ['throughput', OpsThroughputTrendChart, trendProps, 'Line', '#3b82f6', 'borderColor'],
    ['switch rate', OpsSwitchRateTrendChart, trendProps, 'Line', '#14b8a6', 'borderColor'],
    ['latency', OpsLatencyChart, latencyProps, 'Bar', '#3b82f6', 'backgroundColor'],
  ] as const)('updates %s accent and chart neutrals without remounting', async (_name, component, props, chartName, original, colorKey) => {
    const wrapper = mount(component as Component, { props, global })
    const chart = wrapper.getComponent({ name: chartName })
    expect(chart.props('data').datasets[0][colorKey]).toBe(original)
    expect(chart.props('options').scales.y.grid.color).toBe('#f3f4f6')
    expect(chart.props('options').plugins.tooltip.backgroundColor).toBe(
      chartName === 'Bar' ? 'rgba(0, 0, 0, 0.8)' : '#ffffff',
    )

    theme.selected = true
    await nextTick()
    expect(chart.props('data').datasets[0][colorKey]).toBe('#f97316')
    expect(chart.props('options').scales.y.grid.color).toBe('#eadbcd')
    expect(chart.props('options').scales.x.ticks.color).toBe('#92735c')
    expect(chart.props('options').plugins.tooltip).toMatchObject({
      backgroundColor: '#faf2e9', titleColor: '#251a10', bodyColor: '#685343',
    })

    theme.dark = true
    await nextTick()
    expect(chart.props('data').datasets[0][colorKey]).toBe('#fb923c')

    theme.selected = false
    await nextTick()
    expect(chart.props('data').datasets[0][colorKey]).toBe(original)
    expect(chart.props('options').scales.y.grid.color).toBe('#374151')
    expect(chart.props('options').scales.x.ticks.color).toBe('#9ca3af')
    expect(chart.props('options').plugins.tooltip.backgroundColor).toBe(
      chartName === 'Bar' ? 'rgba(0, 0, 0, 0.8)' : '#1f2937',
    )
    wrapper.unmount()
  })

  it('keeps TPS distinct and its QPS legend synchronized with the themed dataset', async () => {
    const wrapper = mount(OpsThroughputTrendChart, { props: trendProps, global })
    const chart = wrapper.getComponent({ name: 'Line' })
    theme.selected = true
    theme.dark = true
    await nextTick()
    expect(chart.props('data').datasets[0]).toMatchObject({
      borderColor: '#fb923c', backgroundColor: `rgba(251, 146, 60, ${32 / 255})`,
    })
    expect(chart.props('data').datasets[1]).toMatchObject({
      borderColor: '#10b981', backgroundColor: '#10b98120',
    })
    const swatch = wrapper.get('[data-testid="throughput-chart-toolbar"] span span')
    expect(swatch.attributes('style')).toContain('background-color: rgb(251, 146, 60)')
    wrapper.unmount()
  })

  it('keeps error-category hues while reacting to skin and dark-mode neutrals', async () => {
    const trend = mount(OpsErrorTrendChart, {
      props: {
        loading: false, timeRange: '1h',
        points: [{ bucket_start: points[0].bucket_start, error_count_total: 3, error_count_sla: 1,
          business_limited_count: 1, upstream_error_count_excl_429_529: 1,
          upstream_429_count: 0, upstream_529_count: 0 }],
      }, global,
    })
    const distribution = mount(OpsErrorDistributionChart, {
      props: { loading: false, data: { total: 3, items: [
        { status_code: 400, total: 1, sla: 1, business_limited: 0 },
        { status_code: 500, total: 1, sla: 1, business_limited: 0 },
        { status_code: 503, total: 1, sla: 1, business_limited: 0 },
      ] } }, global,
    })
    const line = trend.getComponent({ name: 'Line' })
    const doughnut = distribution.getComponent({ name: 'Doughnut' })
    const originalTrendColors = line.props('data').datasets.map((dataset: { borderColor: string }) => dataset.borderColor)
    const originalCategories = doughnut.props('data').datasets[0].backgroundColor
    expect(originalTrendColors).toEqual(['#ef4444', '#8b5cf6', '#9ca3af'])
    expect(originalCategories).toEqual(['#f59e0b', '#3b82f6', '#ef4444'])

    theme.selected = true
    await nextTick()
    expect(line.props('options').plugins.tooltip.backgroundColor).toBe('#faf2e9')
    expect(doughnut.props('options').plugins.tooltip.backgroundColor).toBe('#faf2e9')
    expect(line.props('data').datasets.map((dataset: { borderColor: string }) => dataset.borderColor)).toEqual(originalTrendColors)
    expect(doughnut.props('data').datasets[0].backgroundColor).toEqual(originalCategories)

    theme.selected = false
    theme.dark = true
    await nextTick()
    expect(line.props('options').plugins.tooltip.backgroundColor).toBe('#1f2937')
    expect(doughnut.props('options').plugins.tooltip.backgroundColor).toBe('#1f2937')
    trend.unmount()
    distribution.unmount()
  })
})
