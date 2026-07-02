// ── Walk-forward 回測：驗證預測引擎的真實命中率 ──
// 對每一根歷史 K 棒，只用「當時看得到的資料」做預測，再和下一根實際漲跌對答案。
// 用法：node scripts/backtest.mjs [symbol]

import { predictToday } from '../src/utils/technical.js'

const KEY = '5d7d4665dc2e4a3297213c1aaa4439bc'
const SYM = process.argv[2] || 'QQQ'

async function fetchSeries(symbol, interval, size) {
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=${size}&apikey=${KEY}`
  const r = await fetch(url)
  const d = await r.json()
  if (!d.values) {
    console.log(`  ${interval}: 取得資料失敗 — ${d.message?.slice(0, 100)}`)
    return null
  }
  return d.values.map(v => ({
    time: Math.floor(new Date(v.datetime.replace(' ', 'T')).getTime() / 1000),
    open: +v.open, high: +v.high, low: +v.low, close: +v.close,
    volume: v.volume != null ? +v.volume : null,
  })).filter(c => c.open && c.high && c.low && c.close).reverse()
}

function pct(a, b) { return b ? (a / b * 100).toFixed(1) : '—' }

function walkForward(candles, unit, evalBars = 300) {
  const results = []
  const start = Math.max(120, candles.length - evalBars)
  for (let t = start; t < candles.length - 1; t++) {
    const p = predictToday(candles.slice(0, t + 1), { unit, minBars: 60 })
    if (!p) continue
    const actualUp = candles[t + 1].close > candles[t].close
    const retPct = (candles[t + 1].close - candles[t].close) / candles[t].close * 100
    results.push({
      upProb: p.upProb, conf: p.confidence,
      predUp: p.upProb >= 50, actualUp, retPct,
      margin: Math.abs(p.upProb - 50),
    })
  }
  return results
}

function report(label, results, candles) {
  if (!results.length) { console.log(`  ${label}: 無有效預測`); return }

  const evalStart = candles.length - results.length - 1
  const upBars = candles.slice(evalStart + 1).filter((c, i) => c.close > candles[evalStart + i].close).length
  const baseline = Math.max(upBars, results.length - upBars)

  const hit = r => r.predUp === r.actualUp
  const all = results
  const m5 = results.filter(r => r.margin >= 5)
  const m10 = results.filter(r => r.margin >= 10)
  const hi = results.filter(r => r.conf === '高')
  const mid = results.filter(r => r.conf === '中')

  console.log(`  ${label}（回測 ${all.length} 根，期間漲跌基準率 ${pct(baseline, all.length)}%）`)
  console.log(`    全部預測      命中 ${all.filter(hit).length}/${all.length} = ${pct(all.filter(hit).length, all.length)}%`)
  console.log(`    優勢≥5%     命中 ${m5.filter(hit).length}/${m5.length} = ${pct(m5.filter(hit).length, m5.length)}%`)
  console.log(`    優勢≥10%    命中 ${m10.filter(hit).length}/${m10.length} = ${pct(m10.filter(hit).length, m10.length)}%`)
  console.log(`    信心=高       命中 ${hi.filter(hit).length}/${hi.length} = ${pct(hi.filter(hit).length, hi.length)}%`)
  console.log(`    信心=中       命中 ${mid.filter(hit).length}/${mid.length} = ${pct(mid.filter(hit).length, mid.length)}%`)

  // 校準：預測機率 vs 實際頻率
  for (const [lo, hiB] of [[50, 55], [55, 60], [60, 101]]) {
    const bucket = results.filter(r => {
      const p = r.predUp ? r.upProb : 100 - r.upProb
      return p >= lo && p < hiB
    })
    if (bucket.length >= 10) {
      console.log(`    預測${lo}~${hiB - 1}%區間  實際命中 ${pct(bucket.filter(hit).length, bucket.length)}%（${bucket.length} 筆）`)
    }
  }

  // 依方向做單的平均報酬（未含點差）
  const avgRet = all.reduce((s, r) => s + (r.predUp ? r.retPct : -r.retPct), 0) / all.length
  const avgRetM10 = m10.length ? m10.reduce((s, r) => s + (r.predUp ? r.retPct : -r.retPct), 0) / m10.length : 0
  console.log(`    依訊號做單平均報酬/根：全部 ${avgRet.toFixed(4)}% · 優勢≥10% ${avgRetM10.toFixed(4)}%（未扣點差）`)
  console.log()
}

console.log(`\n═══ Walk-forward 回測：${SYM} ═══\n`)

const CONFIGS = [
  ['5min',  '根K棒', 1200, 300],
  ['15min', '根K棒', 1200, 300],
  ['1h',    '根K棒', 1200, 300],
  ['1day',  '日',     600, 250],
]

for (const [interval, unit, size, evalBars] of CONFIGS) {
  const candles = await fetchSeries(SYM, interval, size)
  if (!candles || candles.length < 200) continue
  report(`${interval}（共 ${candles.length} 根）`, walkForward(candles, unit, evalBars), candles)
}
