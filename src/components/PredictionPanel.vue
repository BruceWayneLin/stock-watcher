<script setup>
import { computed } from 'vue'

const props = defineProps({
  prediction: { type: Object, required: true },
  currency:   { type: String, default: '$' },
})

const mainProb = computed(() =>
  props.prediction.bullish ? props.prediction.upProb : props.prediction.downProb
)

const mainColor = computed(() =>
  props.prediction.bullish ? '#34d399' : '#f87171'
)

const ringStyle = computed(() => {
  const pct = mainProb.value
  return {
    background: `conic-gradient(${mainColor.value} ${pct * 3.6}deg, #1f2937 ${pct * 3.6}deg)`,
  }
})

const confColor = computed(() => {
  if (props.prediction.confidence === '高') return 'text-emerald-400'
  if (props.prediction.confidence === '中') return 'text-yellow-400'
  return 'text-gray-500'
})
</script>

<template>
  <div class="bg-[#1a1d27] border border-gray-800 rounded-xl p-6">

    <!-- Header -->
    <div class="flex items-center gap-2 mb-5">
      <span class="text-2xl">🐔</span>
      <span class="text-white font-bold text-base">小雞預測</span>
      <span class="text-gray-600 text-xs ml-auto">
        歷史相似天數：{{ prediction.samples }} 天
      </span>
    </div>

    <!-- Main Prediction Ring -->
    <div class="flex justify-center mb-6">
      <div class="relative w-40 h-40 rounded-full p-1.5" :style="ringStyle">
        <div class="w-full h-full rounded-full bg-[#1a1d27] flex flex-col items-center justify-center">
          <span class="text-gray-500 text-xs mb-1">
            {{ prediction.bullish ? '看漲機率' : '看跌機率' }}
          </span>
          <span
            class="text-4xl font-black tracking-tight"
            :style="{ color: mainColor }"
          >
            {{ mainProb }}%
          </span>
          <span :class="confColor" class="text-xs mt-1">
            信心：{{ prediction.confidence }}
          </span>
        </div>
      </div>
    </div>

    <!-- Up / Down bars -->
    <div class="flex gap-3 mb-6">
      <div class="flex-1">
        <div class="flex justify-between text-xs mb-1">
          <span class="text-emerald-400 font-semibold">▲ 漲</span>
          <span class="text-emerald-400">{{ prediction.upProb }}%</span>
        </div>
        <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-emerald-400 rounded-full transition-all duration-500"
            :style="{ width: prediction.upProb + '%' }"
          />
        </div>
      </div>
      <div class="flex-1">
        <div class="flex justify-between text-xs mb-1">
          <span class="text-red-400 font-semibold">▼ 跌</span>
          <span class="text-red-400">{{ prediction.downProb }}%</span>
        </div>
        <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-red-400 rounded-full transition-all duration-500"
            :style="{ width: prediction.downProb + '%' }"
          />
        </div>
      </div>
    </div>

    <!-- Factors -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

      <!-- Bullish -->
      <div v-if="prediction.factors.bullish.length" class="space-y-1.5">
        <p class="text-emerald-400 text-xs font-semibold mb-2">看漲因素</p>
        <div
          v-for="f in prediction.factors.bullish"
          :key="f"
          class="flex items-start gap-2 text-xs"
        >
          <span class="text-emerald-400 mt-0.5 shrink-0">●</span>
          <span class="text-gray-300">{{ f }}</span>
        </div>
      </div>

      <!-- Bearish -->
      <div v-if="prediction.factors.bearish.length" class="space-y-1.5">
        <p class="text-red-400 text-xs font-semibold mb-2">看跌因素</p>
        <div
          v-for="f in prediction.factors.bearish"
          :key="f"
          class="flex items-start gap-2 text-xs"
        >
          <span class="text-red-400 mt-0.5 shrink-0">●</span>
          <span class="text-gray-300">{{ f }}</span>
        </div>
      </div>

    </div>

    <!-- 🐔 當沖交易建議 -->
    <div v-if="prediction.dayTrade" class="mt-6 pt-5 border-t border-gray-800">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-lg">🐔</span>
        <span class="text-white font-bold text-sm">當沖交易建議</span>
        <span class="text-gray-600 text-[10px] ml-auto">
          ATR {{ prediction.dayTrade.atr }} · Pivot {{ prediction.dayTrade.pivot }}
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <!-- 做多當沖 -->
        <div
          class="rounded-lg p-4 border"
          :class="prediction.dayTrade.long.recommended
            ? 'bg-emerald-950/30 border-emerald-800/50'
            : 'bg-gray-900/50 border-gray-800/50'"
        >
          <div class="flex items-center gap-2 mb-3">
            <span class="text-emerald-400 font-bold text-sm">▲ 做多當沖</span>
            <span
              v-if="prediction.dayTrade.long.recommended"
              class="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded"
            >推薦</span>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span class="text-gray-500 text-xs">買進價位</span>
              <span class="text-emerald-400 font-bold text-sm">{{ currency }}{{ prediction.dayTrade.long.buy }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-500 text-xs">賣出價位</span>
              <span class="text-emerald-400 font-bold text-sm">{{ currency }}{{ prediction.dayTrade.long.sell }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-500 text-xs">停損價位</span>
              <span class="text-red-400 font-mono text-xs">{{ currency }}{{ prediction.dayTrade.long.stop }}</span>
            </div>
            <div class="h-px bg-gray-800 my-1" />
            <div class="flex justify-between items-center">
              <span class="text-gray-500 text-xs">預估獲利空間</span>
              <span class="text-emerald-400 font-bold text-sm">{{ prediction.dayTrade.long.profit }}%</span>
            </div>
          </div>
        </div>

        <!-- 賣空當沖 -->
        <div
          class="rounded-lg p-4 border"
          :class="prediction.dayTrade.short.recommended
            ? 'bg-red-950/30 border-red-800/50'
            : 'bg-gray-900/50 border-gray-800/50'"
        >
          <div class="flex items-center gap-2 mb-3">
            <span class="text-red-400 font-bold text-sm">▼ 賣空當沖</span>
            <span
              v-if="prediction.dayTrade.short.recommended"
              class="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded"
            >推薦</span>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <span class="text-gray-500 text-xs">賣空價位</span>
              <span class="text-red-400 font-bold text-sm">{{ currency }}{{ prediction.dayTrade.short.sell }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-500 text-xs">買回價位</span>
              <span class="text-red-400 font-bold text-sm">{{ currency }}{{ prediction.dayTrade.short.cover }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-500 text-xs">停損價位</span>
              <span class="text-red-400 font-mono text-xs">{{ currency }}{{ prediction.dayTrade.short.stop }}</span>
            </div>
            <div class="h-px bg-gray-800 my-1" />
            <div class="flex justify-between items-center">
              <span class="text-gray-500 text-xs">預估獲利空間</span>
              <span class="text-red-400 font-bold text-sm">{{ prediction.dayTrade.short.profit }}%</span>
            </div>
          </div>
        </div>

      </div>

      <!-- 當沖提示 -->
      <div class="mt-3 bg-gray-900/50 rounded-lg px-3 py-2">
        <p class="text-gray-500 text-[10px] leading-relaxed">
          💡 價位根據 Pivot Points、布林通道、ATR 波動度及近 5 日高低點綜合計算。當日收盤前務必平倉。
        </p>
      </div>
    </div>

    <!-- Disclaimer -->
    <p class="text-gray-700 text-[10px] mt-5 text-center leading-relaxed">
      小雞預測基於歷史技術面回測，僅供參考，不構成投資建議。過去表現不代表未來結果。
    </p>

  </div>
</template>
