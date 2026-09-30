import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useSkinStore } from '@/stores/skin'
import { resolveSkin } from '@/config/skins'
import type { MonitorHealth, MonitorMetric } from '@/api/channelMonitorV2'
import DashboardView from '@/views/admin/DashboardView.vue'
import MonitorTrendChart from '@/features/channel-monitor-v2/MonitorTrendChart.vue'
import TokenUsageTrend from '../TokenUsageTrend.vue'
import EndpointDistributionChart from '../EndpointDistributionChart.vue'
import ModelDistributionChart from '../ModelDistributionChart.vue'
import GroupDistributionChart from '../GroupDistributionChart.vue'

vi.mock('vue-i18n', async () => ({
  ...await vi.importActual<typeof import('vue-i18n')>('vue-i18n'),
  useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
}))
vi.mock('vue-chartjs', () => ({
  Line: { name: 'Line', props: ['data', 'options'], template: '<div />' },
  Doughnut: { name: 'Doughnut', props: ['data', 'options'], template: '<div />' },
}))
vi.mock('@/api/admin', () => ({
  adminAPI: {
    dashboard: {
      getSnapshotV2: vi.fn(async () => ({ stats: {}, trend: [], models: [] })),
      getUserUsageTrend: vi.fn(async () => ({
        trend: [{ date: '2026-01-01', user_id: 1, username: 'one', tokens: 100, actual_cost: 1 }],
      })),
      getUserSpendingRanking: vi.fn(async () => ({ ranking: [] })),
    },
  },
}))
vi.mock('@/api/admin/dashboard', () => ({ getUserBreakdown: vi.fn(async () => ({ users: [] })) }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError: vi.fn() }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/composables/useBatchImageAccess', () => ({
  useBatchImageAccess: () => ({ canUseBatchImage: false, refreshBatchImageAccess: vi.fn() }),
}))

const tokenPoint = {
  date: '2026-01-01', requests: 2, input_tokens: 100, output_tokens: 20,
  cache_creation_tokens: 10, cache_read_tokens: 30, total_tokens: 160, cost: 1, actual_cost: 0.5,
}
const counts = { requests: 2, total_tokens: 160, cost: 1, actual_cost: 0.5 }
const metric: MonitorMetric = {
  success_requests: 9, error_requests: 1, request_count: 10, token_count: 160,
  rpm: 10, tpm: 160, error_rate: 0.1, cache_rate: 0.3,
  cache_rate_numerator: 30, cache_rate_denominator: 100,
  ttft: { sample_count: 9, p50_ms: 100, p95_ms: 150, avg_ms: 110 },
  duration: { sample_count: 9, p50_ms: 500, p95_ms: 600, avg_ms: 550 },
}
const health: MonitorHealth = { overall: 'healthy', error_rate: 'healthy', ttft: 'healthy', minimum_sample: 1 }

const wrappers: VueWrapper[] = []
let skin: ReturnType<typeof useSkinStore>

beforeEach(() => {
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-skin')
  localStorage.clear()
  setActivePinia(createPinia())
  skin = useSkinStore()
  skin.initialize()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  skin.$dispose()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-skin')
})

describe('shared chart skin integration', () => {
  it('reactively updates token chart neutrals while retaining all token-series meanings', async () => {
    const wrapper = mount(TokenUsageTrend, { props: { trendData: [tokenPoint] } })
    wrappers.push(wrapper)
    const line = wrapper.findComponent({ name: 'Line' })
    const series = line.props('data').datasets
    expect(series.map((dataset: { borderColor: string }) => dataset.borderColor))
      .toEqual(['#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6'])
    expect(line.props('options').scales.x.grid.color).toBe('#e5e7eb')
    expect(line.props('options').scales.x.ticks.color).toBe('#374151')

    document.documentElement.classList.add('dark')
    await flushPromises()
    expect(line.props('options').scales.x.grid.color).toBe('#374151')
    expect(line.props('options').scales.x.ticks.color).toBe('#e5e7eb')

    for (const id of ['ocean', 'amethyst', 'sunset'] as const) {
      skin.setSkin(id)
      await flushPromises()
      expect(line.props('options').scales.x.grid.color).not.toBe('#374151')
      expect(line.props('data').datasets).toEqual(series)
    }
    skin.resetSkin()
    document.documentElement.classList.remove('dark')
    await flushPromises()
    expect(line.props('options').scales.x.grid.color).toBe('#e5e7eb')
    expect(line.props('options').scales.x.ticks.color).toBe('#374151')
  })

  it('updates monitor canvas and decorative accent without recoloring error, cache, or TTFT', async () => {
    const wrapper = mount(MonitorTrendChart, {
      props: { trend: [{ bucket_start: '2026-01-01T00:00:00Z', metrics: metric, health }], coverage: null },
      global: { stubs: { Icon: true } },
    })
    wrappers.push(wrapper)
    const line = wrapper.findComponent({ name: 'Line' })
    const datasets = line.props('data').datasets
    expect(datasets.map((dataset: { borderColor: string }) => dataset.borderColor))
      .toEqual(['#ef4444', '#10b981', '#0ea5e9'])
    expect(line.props('options').scales.yPct.grid.color).toBe('#f3f4f6')
    expect(line.props('options').plugins.tooltip.backgroundColor).toBe('#ffffff')
    expect(wrapper.find('h2 span').attributes('style')).toContain('rgb(14, 165, 233)')

    skin.setSkin('amethyst')
    await flushPromises()
    const accentRgb = resolveSkin('amethyst').colors[500].split(' ').join(', ')
    expect(wrapper.find('h2 span').attributes('style')).toContain(`rgb(${accentRgb})`)
    expect(line.props('options').scales.yPct.grid.color).not.toBe('#f3f4f6')
    expect(line.props('data').datasets).toEqual(datasets)
    expect(line.props('options').scales.yTtft.ticks.color).toBe('#0ea5e9')
    expect(wrapper.find('.bg-red-500').exists()).toBe(true)
    expect(wrapper.find('.bg-emerald-500').exists()).toBe(true)
    expect(wrapper.find('.bg-sky-500').exists()).toBe(true)

    document.documentElement.classList.add('dark')
    await flushPromises()
    const darkAccentRgb = resolveSkin('amethyst').colors[400].split(' ').join(', ')
    expect(wrapper.find('h2 span').attributes('style')).toContain(`rgb(${darkAccentRgb})`)
    skin.resetSkin()
    await flushPromises()
    expect(line.props('options').scales.yPct.grid.color).toBe('#374151')
    expect(line.props('options').plugins.tooltip.backgroundColor).toBe('#1f2937')
    expect(line.props('options').plugins.tooltip.titleColor).toBe('#f3f4f6')
    expect(line.props('data').datasets).toEqual(datasets)
  })

  it('uses action tokens for dashboard selection and preserves categorical user colors', async () => {
    const wrapper = mount(DashboardView, {
      global: { stubs: {
        AppLayout: { template: '<div><slot /></div>' }, LoadingSpinner: true, Icon: true,
        DateRangePicker: true, Select: true, ModelDistributionChart: true, TokenUsageTrend: true,
      } },
    })
    wrappers.push(wrapper)
    await flushPromises()
    const line = wrapper.findComponent({ name: 'Line' })
    expect(line.props('options').scales.x.ticks.color).toBe('#374151')
    expect(line.props('data').datasets[0].borderColor).toBe('#3b82f6')
    const selected = wrapper.findAll('button').find((button) => button.text() === 'admin.dashboard.tokens')!
    expect(selected.classes()).toContain('bg-action-600')
    expect(wrapper.find('.bg-action-100').exists()).toBe(true)

    skin.setSkin('sunset')
    document.documentElement.classList.add('dark')
    await flushPromises()
    expect(line.props('options').scales.x.ticks.color).not.toBe('#374151')
    expect(line.props('data').datasets[0].borderColor).toBe('#3b82f6')
    skin.resetSkin()
    await flushPromises()
    expect(line.props('options').scales.x.ticks.color).toBe('#e5e7eb')
    expect(line.props('options').scales.x.grid.color).toBe('#374151')
  })

  it('uses themed drilldown links while retaining categorical distribution palettes', async () => {
    const distributions = [
      mount(EndpointDistributionChart, { props: { endpointStats: [{ endpoint: '/v1/messages', ...counts }] } }),
      mount(ModelDistributionChart, { props: { modelStats: [{ model: 'model-one', ...tokenPoint }] } }),
      mount(GroupDistributionChart, { props: { groupStats: [{ group_id: 1, group_name: 'group-one', ...counts }] } }),
    ]
    wrappers.push(...distributions)
    skin.setSkin('sunset')
    await flushPromises()
    for (const wrapper of distributions) {
      const link = wrapper.find('tbody td')
      expect(link.classes()).toContain('text-action-600')
      expect(link.classes()).toContain('hover:text-action-800')
      expect(wrapper.findComponent({ name: 'Doughnut' }).props('data').datasets[0].backgroundColor)
        .toEqual(['#3b82f6'])
      await wrapper.setProps({ enableBreakdown: false })
      expect(wrapper.find('tbody td').classes()).not.toContain('text-action-600')
      expect(wrapper.find('tbody td').classes()).toContain('text-gray-900')
    }
  })
})
