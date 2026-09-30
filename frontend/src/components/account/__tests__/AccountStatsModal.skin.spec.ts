import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSkinStore } from '@/stores/skin'
import { resolveSkin } from '@/config/skins'
import type { Account, AccountUsageStatsResponse } from '@/types'
import AccountStatsModal from '../AccountStatsModal.vue'
import AdminAccountStatsModal from '@/components/admin/account/AccountStatsModal.vue'

vi.mock('vue-i18n', async () => ({
  ...await vi.importActual<typeof import('vue-i18n')>('vue-i18n'),
  useI18n: () => ({ t: (key: string) => key })
}))
vi.mock('vue-chartjs', () => ({
  Line: { name: 'Line', props: ['data', 'options'], template: '<div />' },
  Doughnut: { name: 'Doughnut', props: ['data', 'options'], template: '<div />' }
}))
vi.mock('@/api/admin', () => ({ adminAPI: { accounts: { getStats: vi.fn() } } }))
import { adminAPI } from '@/api/admin'

const stats: AccountUsageStatsResponse = {
  history: [{ date: '2026-09-30', label: '09/30', requests: 1, tokens: 100, cost: 1, actual_cost: 0.5, user_cost: 0.75 }],
  summary: {
    days: 30, actual_days_used: 1, total_cost: 0.5, total_user_cost: 0.75,
    total_standard_cost: 1, total_requests: 1, total_tokens: 100, avg_daily_cost: 0.5,
    avg_daily_user_cost: 0.75, avg_daily_requests: 1, avg_daily_tokens: 100,
    avg_duration_ms: 100, today: null, highest_cost_day: null, highest_request_day: null
  },
  models: [], endpoints: [], upstream_endpoints: []
}

const root = document.documentElement
const wrappers: VueWrapper[] = []
const rgb = (channels: string) => `rgb(${channels.split(' ').join(', ')})`
let skin: ReturnType<typeof useSkinStore>

beforeEach(() => {
  root.className = ''
  root.removeAttribute('style')
  root.removeAttribute('data-skin')
  localStorage.clear()
  setActivePinia(createPinia())
  skin = useSkinStore()
  skin.initialize()
  vi.mocked(adminAPI.accounts.getStats).mockResolvedValue(stats)
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  skin.$dispose()
  root.className = ''
  root.removeAttribute('style')
  root.removeAttribute('data-skin')
  vi.clearAllMocks()
})

describe.each([
  ['account modal', AccountStatsModal],
  ['admin account modal', AdminAccountStatsModal]
] as const)('%s chart skin integration', (_name, component) => {
  it('updates mounted neutral colors in every skin and mode, preserves semantic series, and resets exactly', async () => {
    const wrapper = mount(component, {
      props: { show: false, account: { id: 1, name: 'Example', status: 'active' } as Account },
      global: { stubs: {
        BaseDialog: { template: '<div><slot /><slot name="footer" /></div>' },
        Icon: true, LoadingSpinner: true, ModelDistributionChart: true, EndpointDistributionChart: true
      } }
    })
    wrappers.push(wrapper)
    await wrapper.setProps({ show: true })
    await flushPromises()
    const chart = wrapper.findComponent({ name: 'Line' })
    const series = chart.props('data').datasets
    expect(series.map((dataset: { borderColor: string }) => dataset.borderColor))
      .toEqual(['#3b82f6', '#10b981', '#f97316'])

    for (const dark of [false, true]) {
      root.classList.toggle('dark', dark)
      await flushPromises()
      const defaultOptions = chart.props('options')
      expect(defaultOptions.scales.x.grid.color).toBe(dark ? '#374151' : '#e5e7eb')
      expect(defaultOptions.scales.x.ticks.color).toBe(dark ? '#e5e7eb' : '#374151')
      for (const id of ['ocean', 'amethyst', 'sunset'] as const) {
        skin.setSkin(id)
        await flushPromises()
        const palette = resolveSkin(id).surfaces[dark ? 'dark' : 'gray']
        const options = chart.props('options')
        expect(options.scales.x.grid.color).toBe(rgb(palette[dark ? 700 : 100]))
        expect(options.scales.y.grid.color).toBe(options.scales.x.grid.color)
        expect(options.scales.x.ticks.color).toBe(rgb(palette[dark ? 400 : 500]))
        expect(options.plugins.legend.labels.color).toBe(options.scales.x.ticks.color)
        expect(options.scales.y.ticks.color).toBe('#3b82f6')
        expect(options.scales.y1.ticks.color).toBe('#f97316')
        expect(chart.props('data').datasets).toEqual(series)
      }
      skin.resetSkin()
      await flushPromises()
      expect(JSON.stringify(chart.props('options'))).toBe(JSON.stringify(defaultOptions))
    }
  })
})
