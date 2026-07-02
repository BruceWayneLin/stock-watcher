<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import CandleChart from './CandleChart.vue'
import { computeTASeries, predictToday, walkForwardHitRate } from '../utils/technical.js'
import { cachedFetch } from '../utils/apiCache.js'
import { FINNHUB, FINNHUB_KEY, TWELVE, TWELVE_KEY } from '../utils/config.js'

// 優勢 < 8% 的預測視為雜訊，一律顯示觀望（回測顯示這區間命中率 ≈ 丟銅板）
const NEUTRAL_MARGIN = 8

// NAS100 用 QQQ ETF 追蹤（免費方案無法直接取 NDX 指數，QQQ 走勢完全同步）
const SYMBOL = 'QQQ'

const INTERVALS = [
  { key: '1min',  label: '1分',   ttl: 60_000,      weight: 0.5 },
  { key: '5min',  label: '5分',   ttl: 3 * 60_000,  weight: 0.75 },
  { key: '15min', label: '15分',  ttl: 5 * 60_000,  weight: 1 },
  { key: '30min', label: '30分',  ttl: 10 * 60_000, weight: 1.25 },
  { key: '1h',    label: '1小時', ttl: 15 * 60_000, weight: 1.5 },
  { key: '4h',    label: '4小時', ttl: 30 * 60_000, weight: 1.75 },
]

const selected = ref('5min')
const loading  = ref(false)
const error    = ref('')
const quote    = ref(null)
const tf       = ref({})   // interval key → { candles, prediction, ta, hitRate, error }
const lastUpdate = ref(null)

async function loadInterval(iv) {
  try {
    const url = `${TWELVE}/time_series?symbol=${SYMBOL}&interval=${iv.key}&outputsize=300&apikey=${TWELVE_KEY}`
    const data = await cachedFetch(url, iv.ttl)

    if (data.status === 'error' || !data.values?.length) {
      tf.value[iv.key] = { error: data.message?.includes('run out') ? 'API 次數已滿，稍後再試' : '資料載入失敗' }
      return
    }

    const candles = data.values
      .map(v => ({
        time:   Math.floor(new Date(v.datetime.replace(' ', 'T')).getTime() / 1000),
        open:   parseFloat(v.open),
        high:   parseFloat(v.high),
        low:    parseFloat(v.low),
        close:  parseFloat(v.close),
        volume: v.volume != null ? parseFloat(v.volume) : null,
      }))
      .filter(c => c.open && c.high && c.low && c.close)
      .reverse()

    const prediction = candles.length >= 60
      ? predictToday(candles, { unit: '根K棒', minBars: 60 })
      : null
    const ta = candles.length >= 30 ? computeTASeries(candles) : null

    // K 棒沒變就不重算命中率（walk-forward 較耗時）
    const prevData = tf.value[iv.key]
    const lastTime = candles[candles.length - 1]?.time
    const hitRate = (prevData?.hitRate && prevData?.lastTime === lastTime)
      ? prevData.hitRate
      : walkForwardHitRate(candles, { unit: '根K棒', evalBars: 80, neutralMargin: NEUTRAL_MARGIN })

    tf.value[iv.key] = { candles, prediction, ta, hitRate, lastTime }
  } catch {
    tf.value[iv.key] = { error: '資料載入失敗' }
  }
}

async function loadAll() {
  loading.value = true
  error.value = ''

  try {
    const q = await cachedFetch(`${FINNHUB}/quote?symbol=${SYMBOL}&token=${FINNHUB_KEY}`, 60_000)
    if (q.c) quote.value = q
  } catch { /* 報價失敗不影響分線 */ }

  await Promise.allSettled(INTERVALS.map(iv => loadInterval(iv)))

  const anyOk = INTERVALS.some(iv => tf.value[iv.key]?.candles?.length)
  if (!anyOk) error.value = 'NAS100 資料載入失敗，請稍後再試（免費 API 每分鐘 8 次限制）。'
  else lastUpdate.value = new Date()

  loading.value = false
}

// 60 秒自動更新（cachedFetch 有 TTL，實際只會重抓已過期的週期）
let timer = null
onMounted(() => {
  loadAll()
  timer = setInterval(loadAll, 60_000)
})
onUnmounted(() => clearInterval(timer))

function isNeutral(p) {
  return Math.abs(p.upProb - 50) < NEUTRAL_MARGIN
}

const summary = computed(() =>
  INTERVALS.map(iv => ({ ...iv, d: tf.value[iv.key] ?? null }))
)

// 多時間框架共振：越大的時間框架權重越高
const consensus = computed(() => {
  let score = 0, wsum = 0, count = 0
  for (const iv of INTERVALS) {
    const p = tf.value[iv.key]?.prediction
    if (!p) continue
    score += (p.upProb - 50) * iv.weight
    wsum += iv.weight
    count++
  }
  if (!count) return null
  const s = score / wsum   // -50 ~ +50
  let label, color
  if (s >= 8)       { label = '多時間框架偏多'; color = 'emerald' }
  else if (s >= 3)  { label = '略偏多';        color = 'emerald' }
  else if (s > -3)  { label = '多空分歧，觀望'; color = 'gray' }
  else if (s > -8)  { label = '略偏空';        color = 'red' }
  else              { label = '多時間框架偏空'; color = 'red' }

  const aligned = INTERVALS.filter(iv => {
    const p = tf.value[iv.key]?.prediction
    return p && (s >= 0 ? p.bullish : !p.bullish)
  }).length

  return { score: +s.toFixed(1), label, color, count, aligned }
})

const cur = computed(() => tf.value[selected.value] ?? null)
const curLabel = computed(() => INTERVALS.find(iv => iv.key === selected.value)?.label ?? '')

const quoteUp = computed(() => quote.value && quote.value.d >= 0)

function dirColor(p) {
  return p.bullish ? 'text-emerald-400' : 'text-red-400'
}
</script>

<template>
  <div class="flex flex-col gap-4">

    <!-- ===== 報價 Header ===== -->
    <div class="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-white text-lg font-bold">NAS100 當日預測</span>
            <span class="text-gray-600 text-[10px] bg-gray-800/80 px-1.5 py-0.5 rounded">QQQ 追蹤</span>
          </div>
          <p class="text-gray-600 text-xs mt-1">那斯達克 100 · 六時間框架技術面回測</p>
        </div>
        <div class="text-right">
          <template v-if="quote">
            <p class="text-white text-2xl font-black tracking-tight">${{ quote.c.toFixed(2) }}</p>
            <p class="text-sm font-semibold" :class="quoteUp ? 'text-emerald-400' : 'text-red-400'">
              {{ quoteUp ? '▲ +' : '▼ ' }}{{ quote.d?.toFixed(2) }}（{{ quote.dp?.toFixed(2) }}%）
            </p>
          </template>
          <button
            @click="loadAll"
            :disabled="loading"
            class="mt-1 text-blue-400 hover:text-blue-300 text-xs disabled:opacity-50 cursor-pointer"
          >
            {{ loading ? '載入中...' : '↻ 重新整理' }}
          </button>
          <p v-if="lastUpdate" class="text-gray-700 text-[10px] mt-0.5">
            {{ lastUpdate.toLocaleTimeString('zh-TW', { hour12: false }) }} 更新 · 每 60 秒自動
          </p>
        </div>
      </div>
    </div>

    <div v-if="error" class="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
      {{ error }}
    </div>

    <!-- ===== 多時間框架共振 ===== -->
    <div v-if="consensus" class="bg-[#1a1d27] border rounded-xl p-5" :class="[
      consensus.color === 'emerald' ? 'border-emerald-700/50' :
      consensus.color === 'red' ? 'border-red-700/50' : 'border-gray-800'
    ]">
      <div class="flex items-center justify-between mb-4">
        <span class="text-gray-400 text-sm font-semibold">🧭 多時間框架共振</span>
        <span class="text-lg font-black" :class="[
          consensus.color === 'emerald' ? 'text-emerald-400' :
          consensus.color === 'red' ? 'text-red-400' : 'text-gray-400'
        ]">
          {{ consensus.label }}
        </span>
      </div>

      <!-- 各時間框架一覽 -->
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <button
          v-for="iv in summary"
          :key="iv.key"
          @click="selected = iv.key"
          class="rounded-lg p-2.5 border text-center transition-colors cursor-pointer"
          :class="[
            selected === iv.key ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-[#121420] hover:border-gray-600',
          ]"
        >
          <p class="text-gray-500 text-[10px] mb-1">{{ iv.label }}</p>
          <template v-if="iv.d?.prediction">
            <!-- 優勢不足 → 顯示觀望，不給假方向 -->
            <p v-if="isNeutral(iv.d.prediction)" class="text-base font-black text-gray-500">≈ 觀望</p>
            <p v-else class="text-base font-black" :class="dirColor(iv.d.prediction)">
              {{ iv.d.prediction.bullish ? '▲' : '▼' }}
              {{ iv.d.prediction.bullish ? iv.d.prediction.upProb : iv.d.prediction.downProb }}%
            </p>
            <p v-if="iv.d.hitRate" class="text-[9px]" :class="[
              iv.d.hitRate.rate >= 58 ? 'text-emerald-500' :
              iv.d.hitRate.rate >= 52 ? 'text-yellow-500' : 'text-red-500'
            ]">實測{{ iv.d.hitRate.rate }}%</p>
            <p v-else class="text-[9px] text-gray-600">信心{{ iv.d.prediction.confidence }}</p>
          </template>
          <template v-else-if="iv.d?.error">
            <p class="text-gray-600 text-xs">—</p>
            <p class="text-gray-700 text-[9px]">失敗</p>
          </template>
          <template v-else>
            <p class="text-gray-600 text-xs animate-pulse">...</p>
          </template>
        </button>
      </div>

      <p class="text-gray-600 text-[10px] mt-3">
        {{ consensus.aligned }}/{{ consensus.count }} 個時間框架方向一致 · 共振分數 {{ consensus.score > 0 ? '+' : '' }}{{ consensus.score }}（-50 ~ +50）· 大時間框架權重較高
      </p>
    </div>

    <!-- ===== 選中時間框架細節 ===== -->
    <div v-if="cur?.error" class="bg-[#1a1d27] border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
      {{ curLabel }} 線：{{ cur.error }}
    </div>

    <template v-else-if="cur?.prediction">
      <!-- 預測卡 -->
      <div class="bg-[#1a1d27] border border-gray-800 rounded-xl p-6">
        <div class="flex items-center gap-2 mb-5">
          <span class="text-2xl">🐔</span>
          <span class="text-white font-bold text-base">{{ curLabel }}線預測（下一根 K 棒）</span>
          <span class="text-gray-600 text-xs ml-auto">
            相似樣本 {{ cur.prediction.samples }} 根 · 有效 {{ cur.prediction.effSamples }} · 門檻 {{ Math.round(cur.prediction.threshold * 100) }}%
          </span>
        </div>

        <!-- 實測命中率（walk-forward 對答案，這是最誠實的指標）-->
        <div v-if="cur.hitRate" class="mb-4 rounded-lg px-3 py-2.5 border flex items-center justify-between" :class="[
          cur.hitRate.rate >= 58 ? 'bg-emerald-950/30 border-emerald-800/40' :
          cur.hitRate.rate >= 52 ? 'bg-yellow-950/20 border-yellow-800/30' : 'bg-red-950/30 border-red-800/40'
        ]">
          <span class="text-gray-400 text-xs">
            📏 此時間框架近 {{ cur.hitRate.total }} 根實測命中率
            <span v-if="cur.hitRate.gatedRate != null" class="text-gray-600">（強訊號 {{ cur.hitRate.gatedRate }}%，{{ cur.hitRate.gatedTotal }} 筆）</span>
          </span>
          <span class="text-lg font-black" :class="[
            cur.hitRate.rate >= 58 ? 'text-emerald-400' :
            cur.hitRate.rate >= 52 ? 'text-yellow-400' : 'text-red-400'
          ]">{{ cur.hitRate.rate }}%</span>
        </div>
        <p v-if="cur.hitRate && cur.hitRate.rate < 52" class="text-red-400/90 text-[11px] mb-4">
          ⚠ 此時間框架近期實測命中率不到 52%，訊號目前不可靠，建議改看其他框架或觀望。
        </p>

        <div class="flex items-center gap-6 mb-5">
          <!-- 機率 -->
          <div class="text-center shrink-0">
            <template v-if="isNeutral(cur.prediction)">
              <p class="text-5xl font-black tracking-tight text-gray-500">≈</p>
              <p class="text-xs mt-1 text-gray-500">優勢不足 {{ NEUTRAL_MARGIN }}%，視為觀望</p>
            </template>
            <template v-else>
              <p class="text-5xl font-black tracking-tight" :class="dirColor(cur.prediction)">
                {{ cur.prediction.bullish ? cur.prediction.upProb : cur.prediction.downProb }}%
              </p>
              <p class="text-xs mt-1" :class="dirColor(cur.prediction)">
                {{ cur.prediction.bullish ? '▲ 看漲機率' : '▼ 看跌機率' }}
              </p>
            </template>
            <p class="text-[10px] mt-0.5" :class="[
              cur.prediction.confidence === '高' ? 'text-emerald-400' :
              cur.prediction.confidence === '中' ? 'text-yellow-400' : 'text-gray-500'
            ]">信心：{{ cur.prediction.confidence }}</p>
          </div>

          <!-- 漲跌 bar -->
          <div class="flex-1 space-y-3">
            <div>
              <div class="flex justify-between text-xs mb-1">
                <span class="text-emerald-400 font-semibold">▲ 漲</span>
                <span class="text-emerald-400">{{ cur.prediction.upProb }}%</span>
              </div>
              <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-emerald-400 rounded-full transition-all duration-500" :style="{ width: cur.prediction.upProb + '%' }" />
              </div>
            </div>
            <div>
              <div class="flex justify-between text-xs mb-1">
                <span class="text-red-400 font-semibold">▼ 跌</span>
                <span class="text-red-400">{{ cur.prediction.downProb }}%</span>
              </div>
              <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-red-400 rounded-full transition-all duration-500" :style="{ width: cur.prediction.downProb + '%' }" />
              </div>
            </div>
          </div>
        </div>

        <!-- 操作價位（優勢不足時不給進場價，避免誘導交易）-->
        <div v-if="cur.prediction.dayTrade && !isNeutral(cur.prediction)" class="grid grid-cols-3 gap-3 mb-5">
          <div class="bg-[#121420] rounded-xl p-3 text-center">
            <p class="text-gray-600 text-[10px] mb-1">{{ cur.prediction.bullish ? '進場（買）' : '進場（空）' }}</p>
            <p class="text-white text-base font-bold">
              ${{ cur.prediction.bullish ? cur.prediction.dayTrade.long.buy : cur.prediction.dayTrade.short.sell }}
            </p>
          </div>
          <div class="bg-[#121420] rounded-xl p-3 text-center">
            <p class="text-gray-600 text-[10px] mb-1">目標</p>
            <p class="text-base font-bold" :class="dirColor(cur.prediction)">
              ${{ cur.prediction.bullish ? cur.prediction.dayTrade.long.sell : cur.prediction.dayTrade.short.cover }}
            </p>
          </div>
          <div class="bg-[#121420] rounded-xl p-3 text-center">
            <p class="text-gray-600 text-[10px] mb-1">停損</p>
            <p class="text-red-400 text-base font-bold">
              ${{ cur.prediction.bullish ? cur.prediction.dayTrade.long.stop : cur.prediction.dayTrade.short.stop }}
            </p>
          </div>
        </div>

        <!-- 因素 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div v-if="cur.prediction.factors.bullish.length" class="space-y-1.5">
            <p class="text-emerald-400 text-xs font-semibold mb-2">看漲因素</p>
            <div v-for="f in cur.prediction.factors.bullish.slice(0, 5)" :key="f" class="flex items-start gap-2 text-xs">
              <span class="text-emerald-400 mt-0.5 shrink-0">●</span>
              <span class="text-gray-300">{{ f }}</span>
            </div>
          </div>
          <div v-if="cur.prediction.factors.bearish.length" class="space-y-1.5">
            <p class="text-red-400 text-xs font-semibold mb-2">看跌因素</p>
            <div v-for="f in cur.prediction.factors.bearish.slice(0, 5)" :key="f" class="flex items-start gap-2 text-xs">
              <span class="text-red-400 mt-0.5 shrink-0">●</span>
              <span class="text-gray-300">{{ f }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- K 線圖 -->
      <div v-if="cur.candles?.length" class="bg-[#1a1d27] border border-gray-800 rounded-xl p-6">
        <p class="text-gray-400 text-sm font-semibold mb-4">{{ curLabel }} K 線圖（近 {{ cur.candles.length }} 根）</p>
        <CandleChart
          :data="cur.candles"
          :ma10="cur.ta?.ma10Series ?? []"
          :ma20="cur.ta?.ma20Series ?? []"
          :ma50="cur.ta?.ma50Series ?? []"
        />
      </div>
    </template>

    <div v-else-if="loading" class="bg-[#1a1d27] border border-gray-800 rounded-xl p-10 text-center text-gray-500 text-sm">
      NAS100 分線資料載入中...
    </div>

    <p class="text-gray-700 text-[10px] text-center leading-relaxed">
      NAS100 以 QQQ ETF 分線資料回測（走勢與那斯達克 100 指數同步）。<br/>
      預測為歷史技術面統計，僅供參考，不構成投資建議。
    </p>

  </div>
</template>
