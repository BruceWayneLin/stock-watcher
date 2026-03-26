// ── 基本計算 ──────────────────────────────────────

export function sma(data, period) {
  return data.map((_, i) => {
    if (i < period - 1) return null
    const slice = data.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

export function ema(data, period) {
  const k = 2 / (period + 1)
  const result = []
  let prev = null

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
      continue
    }
    if (i === period - 1) {
      prev = data.slice(0, period).reduce((a, b) => a + b, 0) / period
      result.push(prev)
      continue
    }
    prev = data[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

export function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null

  const changes = closes.slice(1).map((c, i) => c - closes[i])
  let avgGain = changes.slice(0, period).filter(c => c > 0).reduce((a, b) => a + b, 0) / period
  let avgLoss = changes.slice(0, period).filter(c => c < 0).map(c => Math.abs(c)).reduce((a, b) => a + b, 0) / period

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast   = ema(closes, fast)
  const emaSlow   = ema(closes, slow)
  const macdLine  = emaFast.map((f, i) => (f !== null && emaSlow[i] !== null) ? f - emaSlow[i] : null)
  const validMacd = macdLine.filter(v => v !== null)
  const sigLine   = ema(validMacd, signal)

  const last  = validMacd[validMacd.length - 1]
  const lastSig = sigLine[sigLine.length - 1]
  const prev  = validMacd[validMacd.length - 2]
  const prevSig = sigLine[sigLine.length - 2]

  return {
    value:  last,
    signal: lastSig,
    // 剛發生黃金交叉（前一根 macd < signal，這一根 macd > signal）
    crossover: prev !== null && prevSig !== null && prev < prevSig && last > lastSig,
    bullish: last > lastSig,
    aboveZero: last > 0,
  }
}

// ── 時間序列輸出（給圖表用）─────────────────────────

export function computeTASeries(candles) {
  const times  = candles.map(c => c.time)
  const closes = candles.map(c => c.close)

  const toSeries = (arr) =>
    arr.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean)

  // MA lines
  const ma10Series = toSeries(sma(closes, 10))
  const ma20Series = toSeries(sma(closes, 20))
  const ma50Series = toSeries(sma(closes, Math.min(50, closes.length)))

  // RSI series
  const rsiArr = closes.map((_, i) => {
    if (i < 15) return null
    return rsi(closes.slice(0, i + 1))
  })
  const rsiSeries = toSeries(rsiArr)

  // MACD series
  const emaFast  = ema(closes, 12)
  const emaSlow  = ema(closes, 26)
  const macdLine = emaFast.map((f, i) =>
    f !== null && emaSlow[i] !== null ? f - emaSlow[i] : null
  )
  const validMacd  = macdLine.filter(v => v !== null)
  const signalLine = ema(validMacd, 9)

  // 對齊時間軸
  let sigIdx = 0
  const macdSeries   = []
  const signalSeries = []
  const histSeries   = []
  let macdCount = 0

  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) continue
    const sig = signalLine[sigIdx] ?? null
    if (sig !== null) {
      const m = macdLine[i]
      const h = m - sig
      macdSeries.push({ time: times[i], value: m })
      signalSeries.push({ time: times[i], value: sig })
      histSeries.push({ time: times[i], value: h, color: h >= 0 ? '#34d399' : '#f87171' })
    }
    sigIdx++
  }

  return { ma10Series, ma20Series, ma50Series, rsiSeries, macdSeries, signalSeries, histSeries }
}

// ── 綜合評分 ──────────────────────────────────────
// 滿分 10 分，分數越高越看漲

export function scoreStock(closes) {
  if (!closes || closes.length < 30) return null

  const last      = closes[closes.length - 1]
  const monthAgo  = closes[closes.length - 21] ?? closes[0]
  const ma10arr   = sma(closes, 10)
  const ma20arr   = sma(closes, 20)
  const ma50arr   = sma(closes, closes.length >= 50 ? 50 : closes.length)
  const ma10      = ma10arr[ma10arr.length - 1]
  const ma20      = ma20arr[ma20arr.length - 1]
  const ma50      = ma50arr[ma50arr.length - 1]
  const rsiVal    = rsi(closes)
  const macdVal   = macd(closes)
  const monthRet  = ((last - monthAgo) / monthAgo) * 100

  let score = 0
  const signals = []

  // MA 多頭排列
  if (ma10 && ma20 && ma10 > ma20)  { score += 1; signals.push('MA10>MA20') }
  if (ma20 && ma50 && ma20 > ma50)  { score += 2; signals.push('黃金交叉') }
  if (ma20 && last > ma20)          { score += 1; signals.push('價>MA20') }
  if (ma50 && last > ma50)          { score += 1; signals.push('價>MA50') }

  // RSI
  if (rsiVal !== null) {
    if (rsiVal >= 50 && rsiVal < 65)  { score += 2; signals.push(`RSI ${rsiVal.toFixed(0)}`) }
    else if (rsiVal >= 65 && rsiVal < 75) { score += 1; signals.push(`RSI ${rsiVal.toFixed(0)}`) }
  }

  // MACD
  if (macdVal.crossover) { score += 2; signals.push('MACD交叉') }
  else if (macdVal.bullish) { score += 1; signals.push('MACD多頭') }
  if (macdVal.aboveZero)  { score += 1; signals.push('MACD>0') }

  return { score, signals, monthRet, rsi: rsiVal, ma10, ma20, ma50 }
}
