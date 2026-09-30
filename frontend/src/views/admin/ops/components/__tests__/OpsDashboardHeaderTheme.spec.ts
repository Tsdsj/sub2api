import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { OpsDashboardOverview } from '@/api/admin/ops'
import OpsDashboardHeader from '../OpsDashboardHeader.vue'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/api', () => ({ adminAPI: { groups: { getAll: vi.fn().mockResolvedValue([]) } } }))
vi.mock('@/api/admin/ops', () => ({ opsAPI: { getRealtimeTrafficSummary: vi.fn() } }))
vi.mock('@/stores', () => ({
  useAdminSettingsStore: () => ({ opsRealtimeMonitoringEnabled: false }),
}))

function mountHeader() {
  return mount(OpsDashboardHeader, {
    props: {
      overview: {
        start_time: '2026-09-30T00:00:00Z', end_time: '2026-09-30T01:00:00Z', platform: '',
        request_count_total: 10, request_count_sla: 10, success_count: 10,
        error_count_total: 0, error_count_sla: 0, business_limited_count: 0,
        token_consumed: 1000, sla: 1, error_rate: 0, upstream_error_rate: 0,
        upstream_error_count_excl_429_529: 0, upstream_429_count: 0, upstream_529_count: 0,
        health_score: 100, qps: { current: 2, peak: 2, avg: 2 },
        tps: { current: 100, peak: 100, avg: 100 }, duration: {}, ttft: {},
      } satisfies OpsDashboardOverview,
      platform: '', groupId: null, timeRange: '1h', queryMode: 'auto',
      loading: false, lastUpdated: null,
    },
    global: { stubs: { Select: true, HelpTooltip: true, BaseDialog: true, Icon: true } },
  })
}

describe('OpsDashboardHeader theme accents', () => {
  it('uses shared tokens for the title, rules action, realtime selection and sparkline', async () => {
    const wrapper = mountHeader()
    await flushPromises()
    expect(wrapper.get('h1 svg').classes()).toContain('text-action-foreground')
    expect(wrapper.classes()).toContain('bg-surface')
    const rules = wrapper.findAll('button').find((button) => button.attributes('title') === 'admin.ops.alertRules.title')
    expect(rules?.classes()).toContain('bg-action-100')
    const minute = wrapper.findAll('button').find((button) => button.text() === '1min')
    expect(minute?.classes()).toContain('bg-action-500')
    const sparkline = wrapper.get('path[vector-effect="non-scaling-stroke"]')
    expect(sparkline.attributes('stroke')).toBe('currentColor')
    expect(sparkline.classes()).toContain('text-action-foreground')
    expect(wrapper.findAll('button.text-action-foreground').length).toBeGreaterThanOrEqual(6)
    wrapper.unmount()
  })

  it('retains semantic health color and realtime-window interaction', async () => {
    const wrapper = mountHeader()
    await flushPromises()
    expect(wrapper.find('circle[stroke="#10b981"]').exists()).toBe(true)
    const fiveMinutes = wrapper.findAll('button').find((button) => button.text() === '5min')!
    await fiveMinutes.trigger('click')
    expect(fiveMinutes.classes()).toContain('bg-action-500')
    const minute = wrapper.findAll('button').find((button) => button.text() === '1min')!
    expect(minute.classes()).not.toContain('bg-action-500')
    wrapper.unmount()
  })
})
