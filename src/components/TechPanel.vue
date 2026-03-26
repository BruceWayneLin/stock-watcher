<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { createChart, LineSeries, HistogramSeries } from 'lightweight-charts'

const props = defineProps({
  rsiSeries:    { type: Array, default: () => [] },
  macdSeries:   { type: Array, default: () => [] },
  signalSeries: { type: Array, default: () => [] },
  histSeries:   { type: Array, default: () => [] },
  score:        { type: Number, default: 0 },
  signals:      { type: Array,  default: () => [] },
  monthRet:     { type: Number, default: 0 },
})

const rsiEl  = ref(null)
const macdEl = ref(null)
let rsiChart = null, macdChart = null

const chartOptions = (height) => ({
  layout: {
    background: { color: '#1a1d27' },
    textColor:  '#9ca3af',
  },
  grid: {
    vertLines: { color: '#1f2330' },
    horzLines: { color: '#1f2330' },
  },
  rightPriceScale: { borderColor: '#2a2d3a' },
  timeScale:       { borderColor: '#2a2d3a', timeVisible: true },
  crosshair: {
    vertLine: { color: '#4f8ef788' },
    horzLine: { color: '#4f8ef788' },
  },
  width:  0,
  height,
})

onMounted(() => {
  // ── RSI Chart ──
  rsiChart = createChart(rsiEl.value, { ...chartOptions(160), width: rsiEl.value.clientWidth })
  const rsiLine = rsiChart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 2, priceLineVisible: false })
  rsiLine.createPriceLine({ price: 70, color: '#f8717155', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '70' })
  rsiLine.createPriceLine({ price: 30, color: '#34d39955', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '30' })
  rsiLine.createPriceLine({ price: 50, color: '#ffffff22', lineWidth: 1, lineStyle: 2 })
  if (props.rsiSeries.length) { rsiLine.setData(props.rsiSeries); rsiChart.timeScale().fitContent() }

  // ── MACD Chart ──
  macdChart = createChart(macdEl.value, { ...chartOptions(160), width: macdEl.value.clientWidth })
  const hist  = macdChart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false })
  const mLine = macdChart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false })
  const sLine = macdChart.addSeries(LineSeries, { color: '#f97316', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false })
  macdChart.addSeries(LineSeries, { color: '#ffffff11', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
    .setData(props.macdSeries.map(d => ({ time: d.time, value: 0 })))

  if (props.histSeries.length)   { hist.setData(props.histSeries);     macdChart.timeScale().fitContent() }
  if (props.macdSeries.length)     mLine.setData(props.macdSeries)
  if (props.signalSeries.length)   sLine.setData(props.signalSeries)

  // Resize
  const ro = new ResizeObserver(() => {
    rsiChart?.applyOptions({ width: rsiEl.value.clientWidth })
    macdChart?.applyOptions({ width: macdEl.value.clientWidth })
  })
  ro.observe(rsiEl.value)
  ro.observe(macdEl.value)
  onUnmounted(() => { ro.disconnect(); rsiChart?.remove(); macdChart?.remove() })
})

function scoreColor(s) {
  if (s >= 8) return 'text-emerald-400'
  if (s >= 5) return 'text-yellow-400'
  return 'text-gray-400'
}
</script>

<template>
  <div class="flex flex-col gap-4">

    <!-- 信號總結 -->
    <div class="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <span class="text-gray-400 text-sm font-semibold">技術分析總結</span>
        <div class="flex items-baseline gap-1">
          <span :class="scoreColor(score)" class="text-2xl font-bold">{{ score }}</span>
          <span class="text-gray-600 text-sm">/ 10</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="sig in signals"
          :key="sig"
          class="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full"
        >
          {{ sig }}
        </span>
        <span v-if="!signals.length" class="text-gray-600 text-sm">無明顯多頭信號</span>
      </div>
      <div class="mt-3 pt-3 border-t border-gray-800 text-sm">
        <span class="text-gray-500">月漲幅：</span>
        <span :class="monthRet >= 0 ? 'text-emerald-400' : 'text-red-400'" class="font-semibold">
          {{ monthRet >= 0 ? '+' : '' }}{{ monthRet.toFixed(2) }}%
        </span>
      </div>
    </div>

    <!-- RSI -->
    <div class="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
      <div class="flex items-center gap-3 mb-3">
        <span class="text-gray-400 text-sm font-semibold">RSI (14)</span>
        <span class="text-xs text-gray-600">超買 &gt;70　超賣 &lt;30</span>
      </div>
      <div ref="rsiEl" class="w-full rounded-lg overflow-hidden" />
    </div>

    <!-- MACD -->
    <div class="bg-[#1a1d27] border border-gray-800 rounded-xl p-5">
      <div class="flex items-center gap-4 mb-3">
        <span class="text-gray-400 text-sm font-semibold">MACD (12, 26, 9)</span>
        <span class="flex items-center gap-1.5 text-xs text-gray-500"><span class="w-3 h-0.5 bg-blue-400 inline-block rounded"></span>MACD</span>
        <span class="flex items-center gap-1.5 text-xs text-gray-500"><span class="w-3 h-0.5 bg-orange-400 inline-block rounded"></span>Signal</span>
      </div>
      <div ref="macdEl" class="w-full rounded-lg overflow-hidden" />
    </div>

  </div>
</template>
