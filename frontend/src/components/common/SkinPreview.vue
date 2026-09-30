<template>
  <div
    class="skin-preview pointer-events-none overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50 p-3 dark:border-dark-700 dark:bg-dark-950 sm:p-4"
    :style="previewStyle"
    aria-hidden="true"
  >
    <div class="flex h-44 overflow-hidden rounded-lg border border-gray-200 bg-surface shadow-sm dark:border-dark-700 dark:bg-dark-900 sm:h-48">
      <div class="flex w-12 shrink-0 flex-col gap-3 border-r border-gray-100 p-2.5 dark:border-dark-800 sm:w-16 sm:p-3">
        <span class="preview-brand mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md">
          <span class="h-2.5 w-2.5 rounded-sm border-2 border-white/90"></span>
        </span>
        <span class="preview-nav flex h-6 items-center justify-center rounded-md">
          <span class="preview-accent h-2 w-3 rounded-sm"></span>
        </span>
        <span v-for="item in 3" :key="item" class="mx-auto h-1.5 w-4 rounded-full bg-gray-200 dark:bg-dark-700"></span>
        <span class="mt-auto h-4 w-4 self-center rounded-full bg-gray-100 dark:bg-dark-800"></span>
      </div>
      <div class="min-w-0 flex-1 p-3 sm:p-4">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="space-y-1.5">
            <div class="h-2 w-16 rounded-full bg-gray-700 dark:bg-dark-200"></div>
            <div class="h-1 w-10 rounded-full bg-gray-200 dark:bg-dark-700"></div>
          </div>
          <span class="preview-brand h-5 w-12 rounded-md"></span>
        </div>
        <div class="mb-3 grid grid-cols-2 gap-2">
          <div class="preview-metric rounded-md border p-2">
            <div class="mb-1 h-1 w-8 rounded-full bg-gray-300 dark:bg-dark-600"></div>
            <div class="text-xs font-semibold leading-none text-gray-800 dark:text-dark-100">24.8k</div>
            <div class="preview-accent mt-1.5 h-1 w-5 rounded-full"></div>
          </div>
          <div class="rounded-md border border-gray-100 p-2 dark:border-dark-800">
            <div class="mb-1 h-1 w-8 rounded-full bg-gray-300 dark:bg-dark-600"></div>
            <div class="text-xs font-semibold leading-none text-gray-800 dark:text-dark-100">99.9%</div>
            <div class="mt-1.5 h-1 w-5 rounded-full bg-gray-200 dark:bg-dark-700"></div>
          </div>
        </div>
        <div class="flex h-[58px] items-end gap-1.5 rounded-md border border-gray-100 px-2 pb-2 pt-3 dark:border-dark-800 sm:h-[66px]">
          <span
            v-for="(height, index) in barHeights"
            :key="index"
            class="preview-bar min-w-0 flex-1 rounded-t-sm"
            :class="{ 'preview-bar-strong': index > 6 }"
            :style="{ height: `${height}%` }"
          ></span>
        </div>
      </div>
    </div>
    <div class="mt-3 flex items-center justify-center gap-1.5">
      <span
        v-for="shade in swatchShades"
        :key="shade"
        class="h-2 w-6 rounded-full"
        :style="{ backgroundColor: `rgb(var(--preview-primary-${shade}))` }"
      ></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { skinVariables, type SkinPreset } from '@/config/skins'

const props = defineProps<{ preset: SkinPreset }>()
const barHeights = [28, 45, 34, 60, 46, 72, 62, 87, 74, 100]
const swatchShades = [300, 400, 500, 600, 700] as const

// Keep each preview's palette independent from the currently applied skin.
const previewStyle = computed(() => ({
  ...skinVariables(props.preset),
  ...Object.fromEntries(
    Object.entries(props.preset.colors).map(([shade, color]) => [
      `--preview-primary-${shade}`,
      color
    ])
  )
}))
</script>

<style scoped>
.preview-brand {
  background: linear-gradient(135deg, rgb(var(--preview-primary-500)), rgb(var(--preview-primary-700)));
}

.preview-nav,
.preview-metric {
  background-color: rgb(var(--preview-primary-50));
}

.preview-metric {
  border-color: rgb(var(--preview-primary-100));
}

.preview-accent {
  background-color: rgb(var(--preview-primary-600));
}

.preview-bar {
  background-color: rgb(var(--preview-primary-200));
}

.preview-bar.preview-bar-strong {
  background-color: rgb(var(--preview-primary-500));
}

.dark .preview-nav,
.dark .preview-metric {
  background-color: rgb(var(--preview-primary-950) / 0.6);
}

.dark .preview-metric {
  border-color: rgb(var(--preview-primary-800) / 0.5);
}

.dark .preview-accent {
  background-color: rgb(var(--preview-primary-400));
}

.dark .preview-bar {
  background-color: rgb(var(--preview-primary-800));
}

.dark .preview-bar.preview-bar-strong {
  background-color: rgb(var(--preview-primary-400));
}
</style>
