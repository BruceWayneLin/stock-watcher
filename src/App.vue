<script setup>
import { ref, computed } from 'vue'
import CandleChart from './components/CandleChart.vue'
import TechPanel   from './components/TechPanel.vue'
import TopStocks   from './components/TopStocks.vue'
import { computeTASeries, scoreStock } from './utils/technical.js'

const activeTab = ref('search') // 'search' | 'top'

// =============================================
//  填入你的 Finnhub API Key
// =============================================
const API_KEY = 'd72fcm1r01qqkte0p75gd72fcm1r01qqkte0p760'
// =============================================

const BASE = 'https://finnhub.io/api/v1'

const symbol     = ref('')
const loading    = ref(false)
const error      = ref('')
const result     = ref(null)
const candleData = ref([])
const taData     = ref(null)   // TA series + score

// 時間區間選項 (Yahoo Finance 格式)
const resolutions = [
  { label: '1W', interval: '15m', range: '5d'  },
  { label: '1M', interval: '1h',  range: '1mo' },
  { label: '3M', interval: '1d',  range: '3mo' },
  { label: '6M', interval: '1d',  range: '6mo' },
  { label: '1Y', interval: '1d',  range: '1y'  },
]
const activeRes = ref(resolutions[3]) // 預設 6M

const changeClass = computed(() =>
  result.value?.isUp ? 'text-emerald-400' : 'text-red-400'
)

// TA 只對日線區間有效
const showTA = computed(() =>
  taData.value && ['3M', '6M', '1Y'].includes(activeRes.value.label)
)

async function search() {
  const sym = symbol.value.trim().toUpperCase()
  if (!sym) return

  loading.value    = true
  error.value      = ''
  result.value     = null
  candleData.value = []
  taData.value     = null

  try {
    const [quote, profile] = await Promise.all([
      fetchJSON(`${BASE}/quote?symbol=${sym}&token=${API_KEY}`),
      fetchJSON(`${BASE}/stock/profile2?symbol=${sym}&token=${API_KEY}`),
    ])

    if (!quote.c) {
      error.value = `找不到股票代號「${sym}」，請確認代號是否正確。`
      return
    }

    const isUp = quote.d >= 0
    result.value = {
      symbol:     sym,
      name:       profile.name || '—',
      price:      fmt(quote.c),
      change:     fmt(Math.abs(quote.d)),
      changePct:  Math.abs(quote.dp).toFixed(2),
      changeSign: isUp ? '▲ +' : '▼ -',
      isUp,
      meta: [
        { label: '開盤', value: fmt(quote.o)  },
        { label: '最高', value: fmt(quote.h)  },
        { label: '最低', value: fmt(quote.l)  },
        { label: '昨收', value: fmt(quote.pc) },
      ],
    }

    await loadCandles(sym)
  } catch (err) {
    if (!result.value) {
      error.value = '查詢失敗，請稍後再試。（' + err.message + '）'
    }
  } finally {
    loading.value = false
  }
}

async function loadCandles(sym) {
  try {
    const { interval, range } = activeRes.value
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}`
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`

    const data = await fetchJSON(proxyUrl)
    const r    = data?.chart?.result?.[0]
    if (!r) return

    const timestamps = r.timestamp
    const q          = r.indicators.quote[0]

    const candles = timestamps
      .map((time, i) => ({
        time:  time,
        open:  q.open[i],
        high:  q.high[i],
        low:   q.low[i],
        close: q.close[i],
      }))
      .filter(c => c.open && c.high && c.low && c.close)

    candleData.value = candles

    // 計算技術分析（僅日線區間）
    if (['3M', '6M', '1Y'].includes(activeRes.value.label) && candles.length >= 30) {
      const series = computeTASeries(candles)
      const score  = scoreStock(candles.map(c => c.close))
      taData.value = { ...series, ...(score ?? {}) }
    } else {
      taData.value = null
    }
  } catch {
    candleData.value = []
    taData.value     = null
  }
}

async function changeResolution(res) {
  if (!result.value) return
  activeRes.value = res
  await loadCandles(result.value.symbol)
}

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function fmt(n) {
  return typeof n === 'number' ? n.toFixed(2) : '—'
}
</script>

<template>
  <div class="min-h-screen flex items-start justify-center px-4 py-16">
    <div class="w-full max-w-2xl">
      <h1 class="text-white text-2xl font-bold tracking-tight mb-6">股票查詢</h1>

      <!-- Tabs -->
      <div class="flex gap-1 mb-6 bg-[#1a1d27] border border-gray-800 rounded-lg p-1 w-fit">
        <button
          @click="activeTab = 'search'"
          :class="activeTab === 'search' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'"
          class="text-sm font-semibold px-4 py-1.5 rounded-md transition-colors cursor-pointer"
        >
          個股查詢
        </button>
        <button
          @click="activeTab = 'top'"
          :class="activeTab === 'top' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'"
          class="text-sm font-semibold px-4 py-1.5 rounded-md transition-colors cursor-pointer"
        >
          技術分析 Top 10
        </button>
      </div>

      <!-- Top Stocks Tab -->
      <TopStocks v-if="activeTab === 'top'" />

      <!-- Search Tab -->
      <template v-if="activeTab === 'search'">

        <!-- Search -->
        <div class="flex gap-2 mb-6">
          <input
            v-model="symbol"
            @keydown.enter="search"
            type="text"
            placeholder="輸入股票代號，例如 AAPL"
            class="flex-1 bg-[#1a1d27] border border-gray-700 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-600 text-sm outline-none focus:border-blue-500 transition-colors"
          />
          <button
            @click="search"
            :disabled="loading"
            class="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-5 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {{ loading ? '查詢中...' : '查詢' }}
          </button>
        </div>

        <!-- Error -->
        <div v-if="error" class="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg mb-4">
          {{ error }}
        </div>

        <!-- Result -->
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
        >
          <div v-if="result" class="flex flex-col gap-4">

            <!-- Info Card -->
            <div class="bg-[#1a1d27] border border-gray-800 rounded-xl p-6">
              <div class="flex justify-between items-start mb-5">
                <div>
                  <span class="text-white text-xl font-bold">{{ result.symbol }}</span>
                  <p class="text-gray-500 text-sm mt-1">{{ result.name }}</p>
                </div>
                <div class="text-right">
                  <p :class="changeClass" class="font-semibold text-base">
                    {{ result.changeSign }}{{ result.change }}
                  </p>
                  <p :class="changeClass" class="text-sm mt-1">
                    {{ result.changeSign }}{{ result.changePct }}%
                  </p>
                </div>
              </div>

              <div class="flex items-baseline gap-3 pb-5 mb-5 border-b border-gray-800">
                <span class="text-gray-500 text-sm">目前價格</span>
                <span class="text-white text-4xl font-bold tracking-tight">${{ result.price }}</span>
              </div>

              <div class="grid grid-cols-4 gap-3">
                <div v-for="item in result.meta" :key="item.label" class="flex flex-col gap-1">
                  <span class="text-gray-600 text-xs uppercase tracking-wide">{{ item.label }}</span>
                  <span class="text-gray-300 text-sm font-medium">{{ item.value }}</span>
                </div>
              </div>
            </div>

            <!-- Chart Card -->
            <div v-if="candleData.length" class="bg-[#1a1d27] border border-gray-800 rounded-xl p-6">
              <div class="flex gap-1 mb-4">
                <button
                  v-for="res in resolutions"
                  :key="res.label"
                  @click="changeResolution(res)"
                  :class="activeRes.label === res.label ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'"
                  class="text-xs font-semibold px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                >
                  {{ res.label }}
                </button>
              </div>

              <CandleChart
                :data="candleData"
                :ma10="taData?.ma10Series ?? []"
                :ma20="taData?.ma20Series ?? []"
                :ma50="taData?.ma50Series ?? []"
              />
            </div>

            <!-- Tech Panel（僅日線區間顯示）-->
            <TechPanel
              v-if="showTA"
              :rsiSeries="taData.rsiSeries"
              :macdSeries="taData.macdSeries"
              :signalSeries="taData.signalSeries"
              :histSeries="taData.histSeries"
              :score="taData.score ?? 0"
              :signals="taData.signals ?? []"
              :monthRet="taData.monthRet ?? 0"
            />

          </div>
        </Transition>

      </template>
    </div>
  </div>
</template>
