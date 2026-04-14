<script setup>
import { computed } from 'vue'
import { analyzeNewsSentiment } from '../utils/reasoning.js'

const props = defineProps({
  prediction: { type: Object, default: null },
  result: { type: Object, default: null },
  newsItems: { type: Array, default: () => [] },
})

const show = computed(() => !!props.prediction?.dayTrade && !!props.result)

// ── 新聞情緒分析 ──
const news = computed(() => {
  const sentiment = analyzeNewsSentiment(props.newsItems)
  const label = sentiment.score > 0.2 ? '偏多' : sentiment.score < -0.2 ? '偏空' : '中性'
  const color = sentiment.score > 0.2 ? 'emerald' : sentiment.score < -0.2 ? 'red' : 'gray'
  return { ...sentiment, label, color }
})

// ── 綜合判斷（技術面 + 新聞面）──
const d = computed(() => {
  if (!show.value) return null
  const p = props.prediction
  const dt = p.dayTrade
  const s = p.stats || {}
  const cur = props.result.currency
  const price = dt.price
  const ns = news.value

  // 用新聞情緒調整原始 action
  // 技術面 action 是基底，新聞可以升級/降級
  let action = dt.action
  let label = dt.actionLabel

  if (ns.total > 0) {
    // 新聞偏多 → 可能升級
    if (ns.score > 0.3 && action === 'buy') { action = 'strong_buy'; label = '強力推薦買進' }
    if (ns.score > 0.2 && action === 'neutral' && p.upProb >= 48) { action = 'buy'; label = '新聞利多，建議買進' }
    // 新聞偏空 → 可能降級
    if (ns.score < -0.3 && action === 'sell') { action = 'strong_sell'; label = '強力推薦放空' }
    if (ns.score < -0.2 && action === 'neutral' && p.upProb <= 52) { action = 'sell'; label = '新聞利空，建議放空' }
    // 技術看多但新聞很空 → 降級
    if (ns.score < -0.3 && action === 'buy') { action = 'neutral'; label = '技術偏多但新聞利空，觀望' }
    if (ns.score < -0.3 && action === 'strong_buy') { action = 'buy'; label = '新聞利空，謹慎買進' }
    // 技術看空但新聞很多 → 降級
    if (ns.score > 0.3 && action === 'sell') { action = 'neutral'; label = '技術偏空但新聞利多，觀望' }
    if (ns.score > 0.3 && action === 'strong_sell') { action = 'sell'; label = '新聞利多，謹慎放空' }
  }

  const isBuy = action === 'strong_buy' || action === 'buy'
  const isSell = action === 'strong_sell' || action === 'sell'
  const isStrong = action === 'strong_buy' || action === 'strong_sell'

  const pct = (target) => price > 0 ? ((target - price) / price * 100).toFixed(2) : '0.00'
  const sign = (v) => +v >= 0 ? '+' : ''

  let entry, target, stop, maxTarget
  if (isBuy) {
    entry = dt.long.buy
    target = dt.targetHigh
    stop = dt.long.stop
    maxTarget = dt.maxPossible
  } else if (isSell) {
    entry = dt.short.sell
    target = dt.short.cover
    stop = dt.short.stop
    maxTarget = dt.minPossible
  } else {
    entry = price
    target = dt.targetHigh
    stop = null
    maxTarget = dt.maxPossible
  }

  const entryPct = pct(entry)
  const targetPct = pct(target)
  const stopPct = stop ? pct(stop) : null
  const maxPct = pct(maxTarget)

  const winRate = isBuy ? (s.winRate ?? p.upProb) : isSell ? (100 - (s.winRate ?? p.upProb)) : (s.winRate ?? p.upProb)

  // 推薦理由：技術面 + 新聞面
  let reasons
  if (isBuy) {
    reasons = [...p.factors.bullish.slice(0, 3)]
  } else if (isSell) {
    reasons = [...p.factors.bearish.slice(0, 3)]
  } else {
    reasons = [...p.factors.bullish.slice(0, 2), ...p.factors.bearish.slice(0, 2)]
  }
  // 加入新聞判斷理由
  if (ns.total > 0) {
    reasons.push(`新聞情緒${ns.label}（${ns.bullishCount}正面 / ${ns.bearishCount}負面 / ${ns.neutralCount}中性）`)
  }

  return {
    action, label,
    isBuy, isSell, isStrong,
    isNeutral: !isBuy && !isSell,
    cur, price,
    entry, target, stop, maxTarget,
    entryPct, targetPct, stopPct, maxPct,
    sign,
    riskReward: dt.riskReward,
    winRate,
    upCount: s.totalUp ?? 0,
    downCount: s.totalDown ?? 0,
    samples: p.samples,
    confidence: p.confidence,
    upProb: p.upProb,
    downProb: p.downProb,
    reasons,
    patterns: (p.patterns ?? []).slice(0, 2),
    minPossible: dt.minPossible,
    maxPossible: dt.maxPossible,
    // 新聞
    newsScore: ns.score,
    newsLabel: ns.label,
    newsColor: ns.color,
    newsTotal: ns.total,
    newsBull: ns.bullishCount,
    newsBear: ns.bearishCount,
    newsHighlights: ns.highlights,
  }
})

const confPct = computed(() => {
  if (!d.value) return 0
  const c = d.value.confidence
  return c === '高' ? 95 : c === '中' ? 65 : 35
})
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-500 ease-out"
    enter-from-class="opacity-0 scale-95 translate-y-4"
    enter-to-class="opacity-100 scale-100 translate-y-0"
  >
    <div v-if="d" class="rounded-2xl border-2 p-0 mb-5 overflow-hidden" :class="[
      d.isBuy ? 'border-emerald-500/60 bg-gradient-to-br from-emerald-950/40 via-[#1a1d27] to-[#1a1d27]' :
      d.isSell ? 'border-red-500/60 bg-gradient-to-br from-red-950/40 via-[#1a1d27] to-[#1a1d27]' :
      'border-gray-600/60 bg-gradient-to-br from-gray-900/40 via-[#1a1d27] to-[#1a1d27]',
      d.isStrong ? (d.isBuy ? 'shadow-lg shadow-emerald-500/10' : 'shadow-lg shadow-red-500/10') : ''
    ]">

      <!-- ===== Header Banner ===== -->
      <div class="px-6 pt-5 pb-4 flex items-center justify-between" :class="[
        d.isBuy ? 'bg-emerald-500/10' : d.isSell ? 'bg-red-500/10' : 'bg-gray-500/10'
      ]">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full flex items-center justify-center text-2xl" :class="[
            d.isBuy ? 'bg-emerald-500/20' : d.isSell ? 'bg-red-500/20' : 'bg-gray-500/20'
          ]">
            {{ d.isBuy ? '🟢' : d.isSell ? '🔴' : '⚪' }}
          </div>
          <div>
            <p class="text-xl font-black tracking-tight" :class="[
              d.isBuy ? 'text-emerald-400' : d.isSell ? 'text-red-400' : 'text-gray-400'
            ]">
              {{ d.label }}
            </p>
            <p class="text-gray-500 text-xs mt-0.5">
              {{ result.symbol }} · {{ result.name }}
            </p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-gray-500 text-[10px]">信心度</p>
          <p class="text-lg font-black" :class="[
            d.confidence === '高' ? 'text-emerald-400' : d.confidence === '中' ? 'text-yellow-400' : 'text-gray-500'
          ]">{{ d.confidence }}</p>
        </div>
      </div>

      <!-- ===== Price Table ===== -->
      <div class="px-6 py-5">

        <!-- Current price -->
        <div class="flex items-center justify-between mb-4 pb-4 border-b border-gray-800/60">
          <span class="text-gray-500 text-sm">現價</span>
          <span class="text-white text-2xl font-black tracking-tight">{{ d.cur }}{{ d.price }}</span>
        </div>

        <!-- Buy/Sell signals -->
        <div v-if="!d.isNeutral" class="space-y-3 mb-5">
          <!-- Entry -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-base">👉</span>
              <span class="text-gray-400 text-sm font-semibold">{{ d.isBuy ? '建議買入' : '建議放空' }}</span>
            </div>
            <div class="text-right">
              <span class="text-white text-lg font-bold">{{ d.cur }}{{ d.entry }}</span>
              <span class="text-gray-600 text-xs ml-2">({{ d.sign(d.entryPct) }}{{ d.entryPct }}%)</span>
            </div>
          </div>

          <!-- Target -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-base">🎯</span>
              <span class="text-gray-400 text-sm font-semibold">目標賣出</span>
            </div>
            <div class="text-right">
              <span class="text-lg font-bold" :class="d.isBuy ? 'text-emerald-400' : 'text-red-400'">{{ d.cur }}{{ d.target }}</span>
              <span class="text-xs ml-2" :class="d.isBuy ? 'text-emerald-600' : 'text-red-600'">{{ d.sign(d.targetPct) }}{{ d.targetPct }}%</span>
            </div>
          </div>

          <!-- Max possible -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-base">🔥</span>
              <span class="text-gray-400 text-sm font-semibold">最高可能到</span>
            </div>
            <div class="text-right">
              <span class="text-lg font-bold" :class="d.isBuy ? 'text-emerald-300' : 'text-red-300'">{{ d.cur }}{{ d.maxTarget }}</span>
              <span class="text-xs ml-2" :class="d.isBuy ? 'text-emerald-600' : 'text-red-600'">{{ d.sign(d.maxPct) }}{{ d.maxPct }}%</span>
            </div>
          </div>

          <!-- Stop loss -->
          <div class="flex items-center justify-between pt-2 border-t border-gray-800/40">
            <div class="flex items-center gap-2">
              <span class="text-base">🛑</span>
              <span class="text-gray-400 text-sm font-semibold">停損</span>
            </div>
            <div class="text-right">
              <span class="text-red-400 text-lg font-bold">{{ d.cur }}{{ d.stop }}</span>
              <span class="text-red-700 text-xs ml-2">{{ d.sign(d.stopPct) }}{{ d.stopPct }}%</span>
            </div>
          </div>
        </div>

        <!-- Neutral: show range -->
        <div v-else class="mb-5">
          <p class="text-gray-400 text-sm mb-3">多空不明確，建議今天不要進場</p>
          <div class="bg-gray-900/60 rounded-lg p-4">
            <p class="text-gray-500 text-xs mb-2 font-semibold">今日預估波動區間</p>
            <div class="flex items-center justify-between">
              <span class="text-red-400 font-bold">{{ d.cur }}{{ d.minPossible }}</span>
              <div class="flex-1 mx-3 h-2 bg-gray-800 rounded-full overflow-hidden relative">
                <div class="absolute inset-0 bg-gradient-to-r from-red-500/40 via-gray-500/40 to-emerald-500/40 rounded-full" />
              </div>
              <span class="text-emerald-400 font-bold">{{ d.cur }}{{ d.maxPossible }}</span>
            </div>
          </div>
        </div>

        <!-- ===== Stats Row ===== -->
        <div class="grid grid-cols-3 gap-3 mb-5">
          <!-- Win Rate -->
          <div class="bg-[#121420] rounded-xl p-3 text-center">
            <p class="text-gray-600 text-[10px] mb-1">勝率</p>
            <p class="text-2xl font-black" :class="d.winRate >= 60 ? 'text-emerald-400' : d.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'">
              {{ d.winRate }}%
            </p>
            <p class="text-gray-600 text-[10px] mt-1">{{ d.upCount }}漲 / {{ d.downCount }}跌</p>
          </div>
          <!-- Risk Reward -->
          <div class="bg-[#121420] rounded-xl p-3 text-center">
            <p class="text-gray-600 text-[10px] mb-1">風報比</p>
            <p class="text-2xl font-black" :class="d.riskReward >= 2 ? 'text-emerald-400' : d.riskReward >= 1 ? 'text-yellow-400' : 'text-gray-500'">
              1:{{ d.riskReward }}
            </p>
            <p class="text-gray-600 text-[10px] mt-1">{{ d.riskReward >= 2 ? '賺>賠' : d.riskReward >= 1 ? '尚可' : '偏低' }}</p>
          </div>
          <!-- News Sentiment -->
          <div class="bg-[#121420] rounded-xl p-3 text-center">
            <p class="text-gray-600 text-[10px] mb-1">新聞情緒</p>
            <p class="text-2xl font-black" :class="[
              d.newsColor === 'emerald' ? 'text-emerald-400' : d.newsColor === 'red' ? 'text-red-400' : 'text-gray-500'
            ]">
              {{ d.newsTotal > 0 ? d.newsLabel : '—' }}
            </p>
            <p class="text-gray-600 text-[10px] mt-1">
              {{ d.newsTotal > 0 ? `${d.newsBull}正 / ${d.newsBear}負` : '無新聞' }}
            </p>
          </div>
        </div>

        <!-- ===== News Highlights ===== -->
        <div v-if="d.newsHighlights.length" class="mb-4 bg-[#121420] border border-gray-800 rounded-xl p-3">
          <p class="text-gray-500 text-xs font-semibold mb-2">📰 關鍵新聞</p>
          <div class="space-y-1.5">
            <div
              v-for="(h, i) in d.newsHighlights"
              :key="i"
              class="flex items-start gap-2 text-[11px]"
            >
              <span class="shrink-0 mt-0.5" :class="h.sentiment === 'bullish' ? 'text-emerald-400' : 'text-red-400'">
                {{ h.sentiment === 'bullish' ? '▲' : '▼' }}
              </span>
              <span class="text-gray-400 line-clamp-1">{{ h.text }}</span>
            </div>
          </div>
        </div>

        <!-- ===== Reasons ===== -->
        <div class="mb-4">
          <p class="text-gray-500 text-xs font-semibold mb-2">
            {{ d.isBuy ? '推薦理由' : d.isSell ? '放空理由' : '分析要點' }}
          </p>
          <div class="space-y-1.5">
            <div v-for="(r, i) in d.reasons" :key="i" class="flex items-start gap-2 text-xs">
              <span class="shrink-0 mt-0.5" :class="d.isBuy ? 'text-emerald-400' : d.isSell ? 'text-red-400' : 'text-gray-500'">
                {{ d.isBuy ? '✓' : d.isSell ? '✗' : '•' }}
              </span>
              <span class="text-gray-300">{{ r }}</span>
            </div>
          </div>

          <!-- K-line patterns -->
          <div v-if="d.patterns.length" class="mt-2 flex flex-wrap gap-2">
            <span
              v-for="p in d.patterns"
              :key="p.name"
              class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
              :class="p.type === 'bullish' ? 'bg-emerald-500/15 text-emerald-400' : p.type === 'bearish' ? 'bg-red-500/15 text-red-400' : 'bg-gray-500/15 text-gray-400'"
            >
              {{ p.name }}
            </span>
          </div>
        </div>

        <!-- ===== Warnings ===== -->
        <div class="bg-yellow-950/20 border border-yellow-800/30 rounded-lg px-3 py-2.5 mb-3">
          <div class="space-y-1">
            <p v-if="!d.isNeutral" class="text-yellow-500/80 text-[11px] flex items-start gap-1.5">
              <span class="shrink-0">⚠</span> 停損到就執行，不要凹單！
            </p>
            <p class="text-yellow-500/80 text-[11px] flex items-start gap-1.5">
              <span class="shrink-0">⚠</span> 當沖務必收盤前平倉
            </p>
            <p v-if="d.confidence === '低'" class="text-yellow-500/80 text-[11px] flex items-start gap-1.5">
              <span class="shrink-0">⚠</span> 信心度低，樣本不足，輕倉操作
            </p>
            <p v-if="d.newsColor === 'red' && !d.isSell" class="text-yellow-500/80 text-[11px] flex items-start gap-1.5">
              <span class="shrink-0">⚠</span> 新聞面偏空，注意突發利空風險
            </p>
          </div>
        </div>

        <!-- Disclaimer -->
        <p class="text-gray-700 text-[10px] text-center leading-relaxed">
          綜合技術面＋新聞面分析，僅供參考，不構成投資建議。過去表現不代表未來結果。
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
