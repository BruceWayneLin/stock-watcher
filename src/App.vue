<script setup>
import { ref, computed } from 'vue'
import CandleChart      from './components/CandleChart.vue'
import TechPanel        from './components/TechPanel.vue'
import PredictionPanel  from './components/PredictionPanel.vue'
import NewsPanel        from './components/NewsPanel.vue'
import ReasoningPanel   from './components/ReasoningPanel.vue'
import ChickenOracle    from './components/ChickenOracle.vue'
import ActionCard       from './components/ActionCard.vue'
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
const market     = ref('US')
const loading    = ref(false)
const error      = ref('')
const result     = ref(null)
const candleData = ref([])
const taData     = ref(null)
const prediction = ref(null)
const newsData   = ref([])

const MARKETS = {
  US:  { label: '🇺🇸 美股', currency: '$',  exchange: '',     placeholder: '例如 AAPL、TSLA' },
  TW:  { label: '🇹🇼 台股', currency: 'NT$', exchange: 'TWSE', placeholder: '例如 2330、2603' },
  JP:  { label: '🇯🇵 日股', currency: '¥',   exchange: 'TSE',  placeholder: '例如 7203、6758' },
  KR:  { label: '🇰🇷 韓股', currency: '₩',   exchange: 'KRX',  placeholder: '例如 005930' },
}

const currentMarket = computed(() => MARKETS[market.value])
const visibleMarkets = computed(() =>
  Object.entries(MARKETS).filter(([key]) => key === 'US')
)

const needKey = computed(() => !TWELVE_KEY)

const changeClass = computed(() =>
  result.value?.isUp ? 'text-emerald-400' : 'text-red-400'
)

// 組合 Twelve Data 用的 symbol 參數
function twelveSymbol(sym) {
  const mkt = MARKETS[market.value]
  return mkt.exchange ? `${sym}&exchange=${mkt.exchange}` : sym
}

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
  newsData.value   = []

  const mkt = MARKETS[market.value]
  const cur = mkt.currency

  try {
    if (market.value === 'US') {
      // 美股：Finnhub 即時報價 + 公司資料
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
        symbol: sym, currency: cur,
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
    } else {
      // 非美股：用 Twelve Data /quote 端點
      const quoteUrl = `${TWELVE}/quote?symbol=${twelveSymbol(sym)}&apikey=${TWELVE_KEY}`
      const q = await cachedFetch(quoteUrl, 2 * 60 * 1000)

      if (q.status === 'error' || !q.close) {
        error.value = `找不到 ${mkt.label} 股票代號「${sym}」，請確認代號是否正確。`
        return
      }

      const close = parseFloat(q.close)
      const open  = parseFloat(q.open)
      const high  = parseFloat(q.high)
      const low   = parseFloat(q.low)
      const prev  = parseFloat(q.previous_close)
      const change = close - prev
      const changePct = prev ? ((change / prev) * 100) : 0
      const isUp = change >= 0

      result.value = {
        symbol: sym, currency: cur,
        name:   q.name || '—',
        price:  fmt(close),
        change: fmt(Math.abs(change)),
        changePct: Math.abs(changePct).toFixed(2),
        changeSign: isUp ? '▲ +' : '▼ -',
        isUp,
        meta: [
          { label: '開盤', value: fmt(open) },
          { label: '最高', value: fmt(high) },
          { label: '最低', value: fmt(low)  },
          { label: '昨收', value: fmt(prev) },
        ],
      }
    }

    // Twelve Data 6 個月日線 + 新聞
    await Promise.all([loadCandles(sym), loadNews(sym)])
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
    const url = `${TWELVE}/time_series?symbol=${twelveSymbol(sym)}&interval=1day&outputsize=130&apikey=${TWELVE_KEY}`
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

async function loadNews(sym) {
  try {
    const today = new Date()
    const from  = new Date(today)
    from.setDate(from.getDate() - 7)
    const toStr   = today.toISOString().slice(0, 10)
    const fromStr = from.toISOString().slice(0, 10)

    if (market.value === 'US') {
      // 美股：抓公司新聞
      const url = `${FINNHUB}/company-news?symbol=${sym}&from=${fromStr}&to=${toStr}&token=${FINNHUB_KEY}`
      const data = await cachedFetch(url, 10 * 60 * 1000)
      if (Array.isArray(data)) {
        newsData.value = data.slice(0, 8)
      }
    } else {
      // 非美股：抓一般市場新聞
      const url = `${FINNHUB}/news?category=general&token=${FINNHUB_KEY}`
      const data = await cachedFetch(url, 10 * 60 * 1000)
      if (Array.isArray(data)) {
        newsData.value = data.slice(0, 8)
      }
    }
  } catch {
    // 新聞載入失敗不影響其他功能
  }
}

function fmt(n) {
  return typeof n === 'number' ? n.toFixed(2) : '—'
}
</script>

<template>
  <div class="min-h-screen flex items-start justify-center px-4 py-12">
    <div class="w-full max-w-2xl">

      <div class="flex items-center gap-3 mb-4">
        <span class="text-3xl">🐔</span>
        <div>
          <h1 class="text-white text-2xl font-bold tracking-tight">小雞分析</h1>
          <p class="text-gray-600 text-xs">技術面回測 · 當日漲跌預測 · 當沖交易建議</p>
        </div>
      </div>

      <!-- 🐣 小雞占卜 -->
      <ChickenOracle :taData="taData" :prediction="prediction" :result="result" />

      <!-- 技術分析說明 -->
      <details class="mb-6 bg-[#1a1d27] border border-gray-800 rounded-xl overflow-hidden">
        <summary class="px-4 py-3 text-gray-400 text-xs font-semibold cursor-pointer hover:text-gray-300 transition-colors select-none flex items-center gap-2">
          <span class="text-sm">📊</span> 系統使用的技術分析指標說明
          <span class="text-gray-600 text-[10px] ml-auto">點擊展開</span>
        </summary>
        <div class="px-4 pb-4 pt-1 border-t border-gray-800/50">

          <!-- 小雞預測 -->
          <p class="text-blue-400 text-xs font-semibold mt-3 mb-2">🐔 小雞預測（漲跌機率）</p>
          <p class="text-gray-500 text-[11px] mb-2 leading-relaxed">
            從半年歷史日線中，找出技術面相似度 ≥ 70% 的交易日，以加權統計隔天漲跌比例得出機率。
          </p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] mb-4">
            <div class="flex justify-between"><span class="text-gray-500">MA10 / MA20 / MA50</span><span class="text-gray-400">趨勢方向判斷</span></div>
            <div class="flex justify-between"><span class="text-gray-500">RSI(14)</span><span class="text-gray-400">超買超賣分區</span></div>
            <div class="flex justify-between"><span class="text-gray-500">MACD(12,26,9)</span><span class="text-gray-400">多空動能</span></div>
            <div class="flex justify-between"><span class="text-gray-500">布林通道(20,2σ)</span><span class="text-gray-400">價格通道位置</span></div>
            <div class="flex justify-between"><span class="text-gray-500">3日 / 5日動量</span><span class="text-gray-400">短期力道</span></div>
          </div>

          <!-- 當沖交易建議 -->
          <p class="text-blue-400 text-xs font-semibold mb-2">🐔 當沖交易價位計算</p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] mb-3">
            <div class="flex justify-between"><span class="text-gray-500">Pivot Points</span><span class="text-gray-400">前日 H/L/C → S1/R1</span></div>
            <div class="flex justify-between"><span class="text-gray-500">布林通道</span><span class="text-gray-400">超買超賣邊界</span></div>
            <div class="flex justify-between"><span class="text-gray-500">ATR(14)</span><span class="text-gray-400">波動度 · 停損距離</span></div>
            <div class="flex justify-between"><span class="text-gray-500">5日高低點</span><span class="text-gray-400">短期支撐壓力</span></div>
          </div>

          <!-- 新增指標 -->
          <p class="text-blue-400 text-xs font-semibold mt-3 mb-2">🕯 K 線型態偵測</p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] mb-4">
            <div class="flex justify-between"><span class="text-gray-500">多頭/空頭吞噬</span><span class="text-gray-400">反轉訊號</span></div>
            <div class="flex justify-between"><span class="text-gray-500">錘子線/射擊之星</span><span class="text-gray-400">頂底訊號</span></div>
            <div class="flex justify-between"><span class="text-gray-500">三紅兵/三黑鴉</span><span class="text-gray-400">趨勢確認</span></div>
            <div class="flex justify-between"><span class="text-gray-500">跳空缺口</span><span class="text-gray-400">突破訊號</span></div>
          </div>

          <p class="text-blue-400 text-xs font-semibold mb-2">📐 目標價計算（多方法交叉驗證）</p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] mb-4">
            <div class="flex justify-between"><span class="text-gray-500">Pivot Points</span><span class="text-gray-400">S1/R1/S2/R2</span></div>
            <div class="flex justify-between"><span class="text-gray-500">Fibonacci</span><span class="text-gray-400">23.6%/61.8% 延伸</span></div>
            <div class="flex justify-between"><span class="text-gray-500">歷史回測 P75</span><span class="text-gray-400">相似天 75% 分位</span></div>
            <div class="flex justify-between"><span class="text-gray-500">布林 + ATR</span><span class="text-gray-400">波動邊界</span></div>
          </div>

          <!-- 公式 -->
          <p class="text-blue-400 text-xs font-semibold mb-2">計算公式</p>
          <div class="space-y-1 text-[10px] font-mono">
            <p class="text-emerald-400/80">▲ 做多：買進 = max(S1, BB下軌, 現價−0.5×ATR)　賣出 = min(R1, BB上軌, 現價+1.2×ATR)</p>
            <p class="text-red-400/80">▼ 賣空：賣空 = min(R1, BB上軌, 現價+0.5×ATR)　買回 = max(S1, BB下軌, 現價−1.2×ATR)</p>
            <p class="text-yellow-400/80">🎯 目標價 = median(Pivot R1, BB上軌, 5日高, Fib 23.6%, 歷史P75)</p>
            <p class="text-orange-400/80">🔥 最高價 = median(Pivot R2, Fib 61.8%, 歷史最大, BB上軌×1.01)</p>
            <p class="text-gray-600">停損 = 進場價 ± 0.5×ATR</p>
          </div>

          <p class="text-gray-700 text-[10px] mt-3">
            資料來源：Twelve Data 6 個月日線 · Finnhub 即時報價
          </p>
        </div>
      </details>

      <!-- 缺 Key 提示 -->
      <div v-if="needKey" class="bg-yellow-950/50 border border-yellow-800/50 text-yellow-400 text-sm px-4 py-3 rounded-lg mb-4">
        請先至 <span class="underline">twelvedata.com</span> 免費申請 API Key，<br/>
        然後貼到 <code class="text-yellow-300">src/App.vue</code> 的 <code class="text-yellow-300">TWELVE_KEY</code>
      </div>

      <!-- 市場選擇 -->
      <div class="flex gap-2 mb-3">
        <button
          v-for="[key, mkt] in visibleMarkets"
          :key="key"
          @click="market = key"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          :class="market === key
            ? 'bg-blue-500 text-white'
            : 'bg-[#1a1d27] text-gray-500 border border-gray-800 hover:text-gray-300'"
        >
          {{ mkt.label }}
        </button>
      </div>

      <div class="flex gap-2 mb-6">
        <input
          v-model="symbol"
          @keydown.enter="search"
          type="text"
          :placeholder="'輸入股票代號，' + currentMarket.placeholder"
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
              <span class="text-white text-4xl font-bold tracking-tight">{{ result.currency }}{{ result.price }}</span>
            </div>
            <div class="grid grid-cols-4 gap-3">
              <div v-for="item in result.meta" :key="item.label" class="flex flex-col gap-1">
                <span class="text-gray-600 text-xs uppercase tracking-wide">{{ item.label }}</span>
                <span class="text-gray-300 text-sm font-medium">{{ item.value }}</span>
              </div>
            </div>
          </div>

          <!-- 🎯 今日操作推薦（英雄卡） -->
          <ActionCard
            v-if="prediction"
            :prediction="prediction"
            :result="result"
          />

          <!-- 🧠 推理引擎 -->
          <ReasoningPanel
            v-if="taData || newsData.length"
            :taData="taData"
            :prediction="prediction"
            :newsItems="newsData"
            :result="result"
          />

          <!-- 📰 最新新聞 -->
          <NewsPanel v-if="newsData.length" :news="newsData" :symbol="result.symbol" />

          <!-- 🐔 小雞預測 -->
          <PredictionPanel v-if="prediction" :prediction="prediction" :currency="result.currency" />

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
