<script setup>
import { ref } from 'vue'
import { scoreStock } from '../utils/technical.js'

const SCREENERS = [
  { id: 'most_actives', label: '成交量最大' },
  { id: 'day_gainers',  label: '今日漲幅最大' },
  { id: 'day_losers',   label: '今日跌幅最大' },
]
const activeScreener = ref(SCREENERS[0])

const loading  = ref(false)
const progress = ref(0)
const results  = ref([])
const error    = ref('')

async function fetchStockList() {
  const url   = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${activeScreener.value.id}&count=40`
  const proxy = `https://corsproxy.io/?url=${encodeURIComponent(url)}`
  const data  = await (await fetch(proxy)).json()

  const quotes = data?.finance?.result?.[0]?.quotes
  if (!quotes?.length) throw new Error('無法取得股票清單')

  return quotes.map(q => q.symbol).filter(Boolean)
}

async function analyze() {
  loading.value  = true
  progress.value = 0
  results.value  = []
  error.value    = ''

  try {
    const stocks = await fetchStockList()
    const scored = []

    for (let i = 0; i < stocks.length; i += 5) {
      const batch = stocks.slice(i, i + 5)
      await Promise.all(batch.map(async (sym) => {
        try {
          const url   = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=3mo`
          const proxy = `https://corsproxy.io/?url=${encodeURIComponent(url)}`
          const data  = await (await fetch(proxy)).json()

          const r = data?.chart?.result?.[0]
          if (!r) return

          const closes = r.indicators.quote[0].close.filter(Boolean)
          const result = scoreStock(closes)
          if (!result) return

          scored.push({
            symbol:  sym,
            price:   closes[closes.length - 1].toFixed(2),
            ...result,
          })
        } catch {
          // 單支失敗不中斷
        }
      }))

      progress.value = Math.min(Math.round(((i + 5) / stocks.length) * 100), 100)
    }

    if (!scored.length) {
      error.value = '分析失敗，請稍後再試。'
    } else {
      results.value = scored
        .sort((a, b) => b.score - a.score || b.monthRet - a.monthRet)
        .slice(0, 10)
    }
  } catch (e) {
    error.value = '取得清單失敗：' + e.message
  } finally {
    loading.value = false
  }
}

async function switchScreener(s) {
  activeScreener.value = s
  await analyze()
}

function retClass(val) {
  return val >= 0 ? 'text-emerald-400' : 'text-red-400'
}

function scoreColor(score) {
  if (score >= 8) return 'text-emerald-400'
  if (score >= 5) return 'text-yellow-400'
  return 'text-gray-400'
}
</script>

<template>
  <div>
    <!-- Screener Tabs -->
    <div class="flex gap-1 mb-6 bg-[#1a1d27] border border-gray-800 rounded-lg p-1 w-fit">
      <button
        v-for="s in SCREENERS"
        :key="s.id"
        @click="!loading && switchScreener(s)"
        :class="activeScreener.id === s.id ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'"
        class="text-xs font-semibold px-3 py-1.5 rounded-md transition-colors cursor-pointer"
      >
        {{ s.label }}
      </button>
    </div>

    <!-- Start Button -->
    <div v-if="!loading && results.length === 0 && !error" class="text-center py-10">
      <p class="text-gray-500 text-sm mb-5">
        動態從 Yahoo Finance 抓取「{{ activeScreener.label }}」清單<br/>
        計算 3 個月技術指標（MA、RSI、MACD）找出前 10 名
      </p>
      <button
        @click="analyze"
        class="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors cursor-pointer"
      >
        開始分析
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-10">
      <p class="text-gray-400 text-sm text-center mb-4">分析中... {{ progress }}%</p>
      <div class="w-full bg-gray-800 rounded-full h-2">
        <div
          class="bg-blue-500 h-2 rounded-full transition-all duration-300"
          :style="{ width: progress + '%' }"
        />
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
      {{ error }}
    </div>

    <!-- Results -->
    <div v-if="results.length" class="flex flex-col gap-3">
      <div class="flex justify-between items-center mb-1">
        <p class="text-gray-500 text-xs">技術面評分 Top 10（滿分 10 分）</p>
        <button
          @click="analyze"
          class="text-blue-400 hover:text-blue-300 text-xs cursor-pointer transition-colors"
        >
          重新分析
        </button>
      </div>

      <div
        v-for="(stock, idx) in results"
        :key="stock.symbol"
        class="bg-[#1a1d27] border border-gray-800 rounded-xl px-5 py-4 flex items-center gap-4"
      >
        <span class="text-gray-600 text-sm font-bold w-5 shrink-0">{{ idx + 1 }}</span>

        <div class="flex-1 min-w-0">
          <span class="text-white font-bold text-base">{{ stock.symbol }}</span>
          <div class="flex flex-wrap gap-1 mt-1.5">
            <span
              v-for="sig in stock.signals"
              :key="sig"
              class="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-md"
            >
              {{ sig }}
            </span>
          </div>
        </div>

        <div class="text-right shrink-0">
          <p class="text-white text-sm font-semibold">${{ stock.price }}</p>
          <p :class="retClass(stock.monthRet)" class="text-xs mt-0.5">
            {{ stock.monthRet >= 0 ? '+' : '' }}{{ stock.monthRet.toFixed(2) }}%
          </p>
        </div>

        <div class="shrink-0 text-right w-12">
          <span :class="scoreColor(stock.score)" class="text-xl font-bold">{{ stock.score }}</span>
          <p class="text-gray-600 text-xs">/ 10</p>
        </div>
      </div>
    </div>
  </div>
</template>
