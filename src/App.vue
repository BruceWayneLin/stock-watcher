<script setup>
import { ref, computed } from 'vue'
import CandleChart      from './components/CandleChart.vue'
import TechPanel        from './components/TechPanel.vue'
import PredictionPanel  from './components/PredictionPanel.vue'
import { computeTASeries, scoreStock, predictToday } from './utils/technical.js'
import { cachedFetch } from './utils/apiCache.js'

// =============================================
//  API Keys
// =============================================
const FINNHUB_KEY = 'd72fcm1r01qqkte0p75gd72fcm1r01qqkte0p760'
const TWELVE_KEY  = '5d7d4665dc2e4a3297213c1aaa4439bc'
// =============================================

const FINNHUB = 'https://finnhub.io/api/v1'
const TWELVE  = 'https://api.twelvedata.com'

const symbol     = ref('')
const loading    = ref(false)
const error      = ref('')
const result     = ref(null)
const candleData = ref([])
const taData     = ref(null)
const prediction = ref(null)

const needKey = computed(() => !TWELVE_KEY)

const changeClass = computed(() =>
  result.value?.isUp ? 'text-emerald-400' : 'text-red-400'
)

async function search() {
  const sym = symbol.value.trim().toUpperCase()
  if (!sym) return
  if (!TWELVE_KEY) {
    error.value = '請先在 App.vue 填入 Twelve Data API Key（免費申請）'
    return
  }

  loading.value    = true
  error.value      = ''
  result.value     = null
  candleData.value = []
  taData.value     = null
  prediction.value = null

  try {
    // Finnhub 即時報價 + 公司資料
    const [quote, profile] = await Promise.all([
      cachedFetch(`${FINNHUB}/quote?symbol=${sym}&token=${FINNHUB_KEY}`, 2 * 60 * 1000),
      cachedFetch(`${FINNHUB}/stock/profile2?symbol=${sym}&token=${FINNHUB_KEY}`, 30 * 60 * 1000),
    ])

    if (!quote.c) {
      error.value = `找不到股票代號「${sym}」，請確認代號是否正確。`
      return
    }

    const isUp = quote.d >= 0
    result.value = {
      symbol: sym,
      name:   profile.name || '—',
      price:  fmt(quote.c),
      change: fmt(Math.abs(quote.d)),
      changePct: Math.abs(quote.dp).toFixed(2),
      changeSign: isUp ? '▲ +' : '▼ -',
      isUp,
      meta: [
        { label: '開盤', value: fmt(quote.o)  },
        { label: '最高', value: fmt(quote.h)  },
        { label: '最低', value: fmt(quote.l)  },
        { label: '昨收', value: fmt(quote.pc) },
      ],
    }

    // Twelve Data 6 個月日線
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
    const url = `${TWELVE}/time_series?symbol=${sym}&interval=1day&outputsize=130&apikey=${TWELVE_KEY}`
    const data = await cachedFetch(url)

    if (data.status === 'error' || !data.values?.length) return

    const candles = data.values
      .map(v => ({
        time:  Math.floor(new Date(v.datetime).getTime() / 1000),
        open:  parseFloat(v.open),
        high:  parseFloat(v.high),
        low:   parseFloat(v.low),
        close: parseFloat(v.close),
      }))
      .filter(c => c.open && c.high && c.low && c.close)
      .reverse()

    candleData.value = candles

    if (candles.length >= 30) {
      const series = computeTASeries(candles)
      const score  = scoreStock(candles.map(c => c.close))
      taData.value = { ...series, ...(score ?? {}) }
    }

    if (candles.length >= 60) {
      prediction.value = predictToday(candles)
    }
  } catch {
    // K 線失敗不影響報價顯示
  }
}

function fmt(n) {
  return typeof n === 'number' ? n.toFixed(2) : '—'
}
</script>

<template>
  <div class="min-h-screen flex items-start justify-center px-4 py-12">
    <div class="w-full max-w-2xl">

      <div class="flex items-center gap-3 mb-6">
        <span class="text-3xl">🐔</span>
        <div>
          <h1 class="text-white text-2xl font-bold tracking-tight">小雞分析</h1>
          <p class="text-gray-600 text-xs">技術面回測 · 當日漲跌預測</p>
        </div>
      </div>

      <!-- 缺 Key 提示 -->
      <div v-if="needKey" class="bg-yellow-950/50 border border-yellow-800/50 text-yellow-400 text-sm px-4 py-3 rounded-lg mb-4">
        請先至 <span class="underline">twelvedata.com</span> 免費申請 API Key，<br/>
        然後貼到 <code class="text-yellow-300">src/App.vue</code> 的 <code class="text-yellow-300">TWELVE_KEY</code>
      </div>

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
          {{ loading ? '分析中...' : '分析' }}
        </button>
      </div>

      <div v-if="error" class="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg mb-4">
        {{ error }}
      </div>

      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
      >
        <div v-if="result" class="flex flex-col gap-4">

          <!-- 報價卡片 -->
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

          <!-- 🐔 小雞預測 -->
          <PredictionPanel v-if="prediction" :prediction="prediction" />

          <!-- K 線圖 -->
          <div v-if="candleData.length" class="bg-[#1a1d27] border border-gray-800 rounded-xl p-6">
            <p class="text-gray-400 text-sm font-semibold mb-4">6 個月 K 線圖</p>
            <CandleChart
              :data="candleData"
              :ma10="taData?.ma10Series ?? []"
              :ma20="taData?.ma20Series ?? []"
              :ma50="taData?.ma50Series ?? []"
            />
          </div>

          <!-- 技術分析面板 -->
          <TechPanel
            v-if="taData"
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

    </div>
  </div>
</template>
