<template>
  <AppLayout>
    <div class="mx-auto max-w-5xl space-y-6">
      <header class="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div class="max-w-2xl">
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {{ t('skinCenter.title') }}
          </h1>
          <p class="mt-2 text-sm leading-6 text-gray-500 dark:text-dark-400">
            {{ t('skinCenter.subtitle') }}
          </p>
        </div>
        <button
          type="button"
          class="btn btn-secondary shrink-0 self-start disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="skinStore.selectedSkin === 'default' && !skinStore.persistenceError"
          @click="restoreDefault"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
            <path d="M3 10a9 9 0 1 1 1.5 7M3 4v6h6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ t('skinCenter.restoreDefault') }}
        </button>
      </header>

      <fieldset aria-describedby="skin-choice-hint">
        <legend class="mb-1 text-base font-semibold text-gray-900 dark:text-white">
          {{ t('skinCenter.chooseSkin') }}
        </legend>
        <p id="skin-choice-hint" class="mb-5 text-sm text-gray-500 dark:text-dark-400">
          {{ t('skinCenter.choiceHint') }}
        </p>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          <div v-for="preset in SKIN_PRESETS" :key="preset.id" class="relative min-w-0">
            <input
              :id="`skin-${preset.id}`"
              class="peer sr-only"
              type="radio"
              name="skin"
              :value="preset.id"
              :checked="skinStore.selectedSkin === preset.id"
              :aria-labelledby="`skin-${preset.id}-name`"
              :aria-describedby="`skin-${preset.id}-description`"
              @change="selectSkin(preset)"
            />
            <label
              :for="`skin-${preset.id}`"
              class="block h-full cursor-pointer rounded-2xl border bg-surface p-4 shadow-card transition-[border-color,box-shadow] duration-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-primary-600 dark:bg-dark-900 dark:peer-focus-visible:outline-primary-400 motion-reduce:transition-none sm:p-5"
              :class="skinStore.selectedSkin === preset.id
                ? 'border-primary-500 ring-1 ring-primary-500 dark:border-primary-400 dark:ring-primary-400'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-card-hover dark:border-dark-700 dark:hover:border-dark-500'"
            >
              <SkinPreview :preset="preset" />
              <span class="mt-4 flex items-center justify-between gap-3">
                <span :id="`skin-${preset.id}-name`" class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ t(preset.nameKey) }}
                </span>
                <span
                  v-if="skinStore.selectedSkin === preset.id"
                  class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                  aria-hidden="true"
                >
                  <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="m4 10 4 4 8-8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  {{ t('skinCenter.selected') }}
                </span>
                <span v-else class="h-5 w-5 shrink-0 rounded-full border border-gray-300 dark:border-dark-500" aria-hidden="true"></span>
              </span>
              <span :id="`skin-${preset.id}-description`" class="mt-2 block text-sm leading-6 text-gray-500 dark:text-dark-400">
                {{ t(preset.descriptionKey) }}
              </span>
            </label>
          </div>
        </div>
      </fieldset>

      <div class="rounded-xl border border-gray-200 bg-surface/70 p-4 dark:border-dark-800 dark:bg-dark-900/70 sm:p-5">
        <div class="flex gap-3">
          <svg class="mt-0.5 h-5 w-5 shrink-0 text-gray-400 dark:text-dark-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M8 21h8m-4-4v4" stroke-linecap="round" />
          </svg>
          <div>
            <p class="text-sm font-medium text-gray-700 dark:text-dark-200">{{ t('skinCenter.localTitle') }}</p>
            <p class="mt-1 text-sm leading-6 text-gray-500 dark:text-dark-400">{{ t('skinCenter.localDescription') }}</p>
          </div>
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="min-h-6 text-sm leading-6"
        :class="skinStore.persistenceError ? 'text-amber-700 dark:text-amber-300' : 'text-primary-700 dark:text-primary-300'"
      >
        {{ statusMessage }}
      </p>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import SkinPreview from '@/components/common/SkinPreview.vue'
import { SKIN_PRESETS, type SkinPreset } from '@/config/skins'
import { useSkinStore } from '@/stores/skin'

const { t } = useI18n()
const skinStore = useSkinStore()
const lastAction = ref<'applied' | 'restored' | null>(null)

const statusMessage = computed(() => {
  const selectedPreset = SKIN_PRESETS.find((preset) => preset.id === skinStore.selectedSkin)
  const message = lastAction.value === 'restored' && skinStore.selectedSkin === 'default'
    ? t('skinCenter.restored')
    : lastAction.value && selectedPreset
      ? t('skinCenter.applied', { name: t(selectedPreset.nameKey) })
      : ''

  return skinStore.persistenceError
    ? [message, t('skinCenter.persistenceError')].filter(Boolean).join(' ')
    : message
})

function selectSkin(preset: SkinPreset) {
  skinStore.setSkin(preset.id)
  lastAction.value = 'applied'
}

function restoreDefault() {
  skinStore.resetSkin()
  lastAction.value = 'restored'
}
</script>
