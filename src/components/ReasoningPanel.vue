<script setup>
import { computed } from 'vue'
import { generateReasoning } from '../utils/reasoning.js'

const props = defineProps({
  taData:     { type: Object,  default: null },
  prediction: { type: Object,  default: null },
  newsItems:  { type: Array,   default: () => [] },
  result:     { type: Object,  default: null },
})

const reasoning = computed(() =>
  generateReasoning({
    taData:    props.taData,
    prediction: props.prediction,
    newsItems: props.newsItems,
    result:    props.result,
  })
)

const verdictBg = computed(() => {
  const c = reasoning.value.verdict?.color
  if (c === 'emerald') return 'bg-emerald-950/40 border-emerald-800/50'
  if (c === 'red')     return 'bg-red-950/40 border-red-800/50'
  return 'bg-yellow-950/40 border-yellow-800/50'
})

const verdictText = computed(() => {
  const c = reasoning.value.verdict?.color
  if (c === 'emerald') return 'text-emerald-400'
  if (c === 'red')     return 'text-red-400'
  return 'text-yellow-400'
})

function typeColor(type) {
  if (type === 'bull')    return 'text-emerald-400'
  if (type === 'bear')    return 'text-red-400'
  return 'text-gray-400'
}

function typeDot(type) {
  if (type === 'bull')    return 'bg-emerald-400'
  if (type === 'bear')    return 'bg-red-400'
  return 'bg-gray-500'
}
</script>

<template>
  <div class="bg-[#1a1d27] border border-gray-800 rounded-xl p-6">

    <!-- Header -->
    <div class="flex items-center gap-2 mb-5">
      <span class="text-2xl">🧠</span>
      <span class="text-white font-bold text-base">推理引擎</span>
      <span class="text-gray-600 text-xs ml-auto">即時推理分析</span>
    </div>

    <!-- Verdict Banner -->
    <div
      v-if="reasoning.verdict"
      class="rounded-lg border p-4 mb-5 flex items-center justify-between"
      :class="verdictBg"
    >
      <div>
        <p class="text-gray-400 text-xs mb-1">綜合判斷</p>
        <p :class="verdictText" class="text-xl font-black">
          {{ reasoning.verdict.label }}
        </p>
      </div>
      <div class="text-right">
        <p class="text-gray-500 text-xs mb-1">推理信心</p>
        <p :class="reasoning.confidence === '高' ? 'text-emerald-400' : reasoning.confidence === '中' ? 'text-yellow-400' : 'text-gray-500'" class="text-lg font-bold">
          {{ reasoning.confidence }}
        </p>
      </div>
    </div>

    <!-- Reasoning Chain -->
    <div class="relative">
      <!-- Vertical line -->
      <div class="absolute left-[15px] top-3 bottom-3 w-px bg-gray-800" />

      <div v-for="step in reasoning.chain" :key="step.step" class="relative pl-10 pb-5 last:pb-0">
        <!-- Step dot -->
        <div class="absolute left-[9px] top-1 w-[13px] h-[13px] rounded-full bg-[#1a1d27] border-2 border-blue-500 z-10 flex items-center justify-center">
          <div class="w-[5px] h-[5px] rounded-full bg-blue-500" />
        </div>

        <!-- Step content -->
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-sm">{{ step.icon }}</span>
            <span class="text-gray-300 text-xs font-semibold">Step {{ step.step }}：{{ step.title }}</span>
          </div>
          <p class="text-gray-400 text-xs leading-relaxed">{{ step.content }}</p>

          <!-- News highlights -->
          <div v-if="step.details?.length" class="mt-2 space-y-1">
            <div
              v-for="(d, i) in step.details"
              :key="i"
              class="flex items-start gap-2 text-[11px]"
            >
              <span :class="d.type === 'bull' ? 'text-emerald-400' : 'text-red-400'" class="shrink-0 mt-0.5">{{ d.type === 'bull' ? '▲' : '▼' }}</span>
              <span class="text-gray-500 line-clamp-1">{{ d.text }}</span>
            </div>
          </div>

          <!-- Technical indicators -->
          <div v-if="step.indicators?.length" class="mt-2 space-y-1">
            <div
              v-for="(ind, i) in step.indicators"
              :key="i"
              class="flex items-center gap-2 text-[11px]"
            >
              <div class="w-1.5 h-1.5 rounded-full shrink-0" :class="typeDot(ind.type)" />
              <span class="text-gray-500 w-16 shrink-0">{{ ind.label }}</span>
              <span :class="typeColor(ind.type)" class="font-medium">{{ ind.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Risk Warnings -->
    <div v-if="reasoning.risks.length" class="mt-5 pt-4 border-t border-gray-800">
      <p class="text-gray-500 text-xs font-semibold mb-2">⚠ 風險提示</p>
      <div class="space-y-1">
        <p
          v-for="(risk, i) in reasoning.risks"
          :key="i"
          class="text-gray-600 text-[11px] flex items-start gap-1.5"
        >
          <span class="text-yellow-600 shrink-0 mt-0.5">·</span>
          {{ risk }}
        </p>
      </div>
    </div>

  </div>
</template>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
