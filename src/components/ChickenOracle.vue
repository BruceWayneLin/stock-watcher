<script setup>
import { computed } from 'vue'
import { getInvestmentOracle } from '../utils/oracle.js'

const props = defineProps({
  taData: { type: Object, default: null },
  prediction: { type: Object, default: null },
  result: { type: Object, default: null },
})

const oracle = computed(() => getInvestmentOracle({
  taData: props.taData,
  prediction: props.prediction,
  result: props.result,
}))

const todayLuckBar = computed(() => `${oracle.value?.todayLuck?.score ?? 0}%`)
const sideWealthBar = computed(() => `${oracle.value?.sideWealth?.score ?? 0}%`)

// Action signal from prediction
const action = computed(() => {
  const dt = props.prediction?.dayTrade
  if (!dt) return null
  return {
    type: dt.action,
    label: dt.actionLabel,
    isBuy: dt.action === 'strong_buy' || dt.action === 'buy',
    isSell: dt.action === 'strong_sell' || dt.action === 'sell',
  }
})

const winRate = computed(() => props.prediction?.stats?.winRate ?? null)

function barClass(score) {
  if (score >= 86) return 'bg-emerald-500'
  if (score >= 71) return 'bg-emerald-400'
  if (score >= 56) return 'bg-blue-500'
  if (score >= 41) return 'bg-gray-500'
  if (score >= 26) return 'bg-amber-500'
  return 'bg-red-500'
}
</script>

<template>
  <div class="bg-[#1a1d27] border border-gray-800 rounded-xl p-6 mb-6">
    <div class="flex items-start justify-between gap-4 mb-4">
      <div>
        <p class="text-gray-400 text-sm font-semibold">🐣 小雞占卜（投資版）</p>
        <p class="text-gray-600 text-xs mt-1">
          根據技術分析與回測預測產生（{{ oracle?.dateKey }}）
        </p>
      </div>
      <div class="text-right">
        <p class="text-gray-500 text-xs">標的</p>
        <p class="text-white text-sm font-bold">{{ result?.symbol ?? '—' }}</p>
      </div>
    </div>

    <!-- Quick Action Signal (when data available) -->
    <div v-if="action" class="mb-4 rounded-lg p-3 flex items-center justify-between" :class="[
      action.isBuy ? 'bg-emerald-950/30 border border-emerald-800/40' :
      action.isSell ? 'bg-red-950/30 border border-red-800/40' :
      'bg-gray-900/50 border border-gray-700/40'
    ]">
      <div class="flex items-center gap-2">
        <span class="text-lg">{{ action.isBuy ? '🟢' : action.isSell ? '🔴' : '⚪' }}</span>
        <span class="font-bold text-sm" :class="[
          action.isBuy ? 'text-emerald-400' : action.isSell ? 'text-red-400' : 'text-gray-400'
        ]">{{ action.label }}</span>
      </div>
      <div v-if="winRate !== null" class="flex items-center gap-2">
        <span class="text-gray-500 text-xs">勝率</span>
        <span class="font-bold text-sm" :class="winRate >= 60 ? 'text-emerald-400' : winRate >= 50 ? 'text-yellow-400' : 'text-red-400'">
          {{ winRate }}%
        </span>
      </div>
    </div>

    <div v-if="oracle" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-[#121420] border border-gray-800 rounded-xl p-4">
        <div class="flex items-baseline justify-between mb-2">
          <p class="text-gray-400 text-sm font-semibold">今日運勢</p>
          <p class="text-gray-300 text-sm">
            <span class="font-bold text-white">{{ oracle.todayLuck.label }}</span>
            <span class="text-gray-500"> · </span>
            <span class="font-mono">{{ oracle.todayLuck.score }}</span>
          </p>
        </div>
        <div class="h-2 rounded-full bg-gray-800 overflow-hidden">
          <div class="h-2" :class="barClass(oracle.todayLuck.score)" :style="{ width: todayLuckBar }" />
        </div>
        <div class="mt-3">
          <p class="text-gray-600 text-[11px] font-semibold mb-2">依據</p>
          <ul class="space-y-1">
            <li
              v-for="(b, idx) in oracle.basis"
              :key="idx"
              class="text-gray-600 text-[11px] leading-relaxed"
            >
              - <span class="text-gray-500">{{ b }}</span>
            </li>
            <li v-if="!oracle.basis?.length" class="text-gray-600 text-[11px] leading-relaxed">
              - <span class="text-gray-500">請先輸入股票代號並完成分析，才會有占卜依據。</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="bg-[#121420] border border-gray-800 rounded-xl p-4">
        <div class="flex items-baseline justify-between mb-2">
          <p class="text-gray-400 text-sm font-semibold">偏財運</p>
          <p class="text-gray-300 text-sm">
            <span class="font-bold text-white">{{ oracle.sideWealth.label }}</span>
            <span class="text-gray-500"> · </span>
            <span class="font-mono">{{ oracle.sideWealth.score }}</span>
          </p>
        </div>
        <div class="h-2 rounded-full bg-gray-800 overflow-hidden">
          <div class="h-2" :class="barClass(oracle.sideWealth.score)" :style="{ width: sideWealthBar }" />
        </div>
        <div class="mt-3">
          <p class="text-gray-600 text-[11px] font-semibold mb-2">給投資者的建議</p>
          <ul class="space-y-1">
            <li v-for="(a, idx) in oracle.advice" :key="idx" class="text-gray-600 text-[11px] leading-relaxed">
              - <span class="text-gray-500">{{ a }}</span>
            </li>
          </ul>
          <p class="text-gray-700 text-[10px] mt-3 leading-relaxed">
            以技術面/回測數據做「可操作性」提示，非投資建議；請自行評估風險。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
