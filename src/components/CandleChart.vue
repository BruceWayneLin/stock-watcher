<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts'

const props = defineProps({
  data:      { type: Array, required: true },
  ma10:      { type: Array, default: () => [] },
  ma20:      { type: Array, default: () => [] },
  ma50:      { type: Array, default: () => [] },
})

const chartEl = ref(null)
let chart = null
let series = null
let ma10s = null, ma20s = null, ma50s = null

onMounted(() => {
  chart = createChart(chartEl.value, {
    layout: {
      background: { color: '#1a1d27' },
      textColor:  '#9ca3af',
    },
    grid: {
      vertLines: { color: '#1f2330' },
      horzLines: { color: '#1f2330' },
    },
    crosshair: {
      vertLine: { color: '#4f8ef788' },
      horzLine: { color: '#4f8ef788' },
    },
    rightPriceScale: { borderColor: '#2a2d3a' },
    timeScale:       { borderColor: '#2a2d3a', timeVisible: true },
    width:  chartEl.value.clientWidth,
    height: 320,
  })

  series = chart.addSeries(CandlestickSeries, {
    upColor:         '#34d399',
    downColor:       '#f87171',
    borderUpColor:   '#34d399',
    borderDownColor: '#f87171',
    wickUpColor:     '#34d399',
    wickDownColor:   '#f87171',
  })
  series.setData(props.data)

  // MA lines
  ma10s = chart.addSeries(LineSeries, { color: '#facc15', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
  ma20s = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
  ma50s = chart.addSeries(LineSeries, { color: '#f472b6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
  if (props.ma10.length) ma10s.setData(props.ma10)
  if (props.ma20.length) ma20s.setData(props.ma20)
  if (props.ma50.length) ma50s.setData(props.ma50)

  chart.timeScale().fitContent()

  const ro = new ResizeObserver(() => {
    chart?.applyOptions({ width: chartEl.value.clientWidth })
  })
  ro.observe(chartEl.value)
  onUnmounted(() => { ro.disconnect(); chart.remove() })
})

watch(() => props.data, (v) => { series?.setData(v); chart?.timeScale().fitContent() })
watch(() => props.ma10,  (v) => ma10s?.setData(v))
watch(() => props.ma20,  (v) => ma20s?.setData(v))
watch(() => props.ma50,  (v) => ma50s?.setData(v))
</script>

<template>
  <div>
    <!-- MA 圖例 -->
    <div class="flex gap-4 mb-3 text-xs">
      <span class="flex items-center gap-1.5"><span class="w-4 h-0.5 bg-yellow-400 inline-block rounded"></span><span class="text-gray-500">MA10</span></span>
      <span class="flex items-center gap-1.5"><span class="w-4 h-0.5 bg-blue-400 inline-block rounded"></span><span class="text-gray-500">MA20</span></span>
      <span class="flex items-center gap-1.5"><span class="w-4 h-0.5 bg-pink-400 inline-block rounded"></span><span class="text-gray-500">MA50</span></span>
    </div>
    <div ref="chartEl" class="w-full rounded-xl overflow-hidden" />
  </div>
</template>
