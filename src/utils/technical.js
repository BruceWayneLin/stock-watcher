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
    crossover: prev !== null && prevSig !== null && prev < prevSig && last > lastSig,
    bullish: last > lastSig,
    aboveZero: last > 0,
  }
}

// ── 布林通道 ──────────────────────────────────────

export function bollingerBands(closes, period = 20, mult = 2) {
  const mid = sma(closes, period)
  const upper = []
  const lower = []

  for (let i = 0; i < closes.length; i++) {
    if (mid[i] === null) { upper.push(null); lower.push(null); continue }
    const slice = closes.slice(i - period + 1, i + 1)
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mid[i]) ** 2, 0) / period)
    upper.push(mid[i] + mult * std)
    lower.push(mid[i] - mult * std)
  }

  return { upper, mid, lower }
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

  let sigIdx = 0
  const macdSeries   = []
  const signalSeries = []
  const histSeries   = []

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

  if (ma10 && ma20 && ma10 > ma20)  { score += 1; signals.push('MA10>MA20') }
  if (ma20 && ma50 && ma20 > ma50)  { score += 2; signals.push('黃金交叉') }
  if (ma20 && last > ma20)          { score += 1; signals.push('價>MA20') }
  if (ma50 && last > ma50)          { score += 1; signals.push('價>MA50') }

  if (rsiVal !== null) {
    if (rsiVal >= 50 && rsiVal < 65)  { score += 2; signals.push(`RSI ${rsiVal.toFixed(0)}`) }
    else if (rsiVal >= 65 && rsiVal < 75) { score += 1; signals.push(`RSI ${rsiVal.toFixed(0)}`) }
  }

  if (macdVal.crossover) { score += 2; signals.push('MACD交叉') }
  else if (macdVal.bullish) { score += 1; signals.push('MACD多頭') }
  if (macdVal.aboveZero)  { score += 1; signals.push('MACD>0') }

  return { score, signals, monthRet, rsi: rsiVal, ma10, ma20, ma50 }
}

// ── 🐔 小雞預測引擎 ──────────────────────────────────
// 用歷史回測法預測當日漲跌機率
// 在歷史資料中找出技術面狀態相似的日子，統計隔天漲跌比例

function getSignalVector(closes, idx) {
  // 至少需要 50 筆之前的資料
  if (idx < 50) return null

  const slice = closes.slice(0, idx + 1)
  const last  = slice[slice.length - 1]

  const ma10arr = sma(slice, 10)
  const ma20arr = sma(slice, 20)
  const ma50arr = sma(slice, 50)
  const ma10 = ma10arr[ma10arr.length - 1]
  const ma20 = ma20arr[ma20arr.length - 1]
  const ma50 = ma50arr[ma50arr.length - 1]

  if (!ma10 || !ma20 || !ma50) return null

  const rsiVal  = rsi(slice)
  const macdVal = macd(slice)
  if (rsiVal === null || !macdVal.value) return null

  const bb = bollingerBands(slice, 20, 2)
  const bbUpper = bb.upper[bb.upper.length - 1]
  const bbLower = bb.lower[bb.lower.length - 1]
  const bbMid   = bb.mid[bb.mid.length - 1]

  // 3 日與 5 日動量
  const mom3 = idx >= 3 ? (last - closes[idx - 3]) / closes[idx - 3] : 0
  const mom5 = idx >= 5 ? (last - closes[idx - 5]) / closes[idx - 5] : 0

  // 布林位置 0~1（0=下軌, 1=上軌）
  const bbPos = bbUpper !== bbLower ? (last - bbLower) / (bbUpper - bbLower) : 0.5

  return {
    ma10_above_ma20: ma10 > ma20 ? 1 : 0,
    ma20_above_ma50: ma20 > ma50 ? 1 : 0,
    price_above_ma20: last > ma20 ? 1 : 0,
    price_above_ma50: last > ma50 ? 1 : 0,
    rsi_zone: rsiVal < 30 ? 0 : rsiVal < 50 ? 1 : rsiVal < 70 ? 2 : 3,
    macd_bullish: macdVal.bullish ? 1 : 0,
    macd_above_zero: macdVal.aboveZero ? 1 : 0,
    bb_zone: bbPos < 0.2 ? 0 : bbPos < 0.5 ? 1 : bbPos < 0.8 ? 2 : 3,
    mom3_up: mom3 > 0 ? 1 : 0,
    mom5_up: mom5 > 0 ? 1 : 0,
  }
}

function signalSimilarity(a, b) {
  const keys = Object.keys(a)
  let match = 0
  for (const k of keys) {
    if (a[k] === b[k]) match++
  }
  return match / keys.length
}

export function predictToday(candles) {
  const closes = candles.map(c => c.close)
  if (closes.length < 60) return null

  const todayIdx = closes.length - 1
  const todaySignals = getSignalVector(closes, todayIdx)
  if (!todaySignals) return null

  // 回測：對歷史每一天計算相似度，統計隔天漲跌
  let totalUp = 0, totalDown = 0
  let weightedUp = 0, weightedDown = 0
  const factors = { bullish: [], bearish: [] }

  for (let i = 50; i < todayIdx; i++) {
    const histSignals = getSignalVector(closes, i)
    if (!histSignals) continue

    const sim = signalSimilarity(todaySignals, histSignals)
    if (sim < 0.7) continue  // 只看相似度 >= 70% 的日子

    const nextDayChange = closes[i + 1] - closes[i]
    const weight = sim * sim  // 越相似權重越大

    if (nextDayChange > 0) {
      totalUp++
      weightedUp += weight
    } else {
      totalDown++
      weightedDown += weight
    }
  }

  const totalSamples = totalUp + totalDown
  if (totalSamples < 5) return null  // 樣本太少不預測

  const totalWeight = weightedUp + weightedDown
  const upProb  = Math.round((weightedUp / totalWeight) * 100)
  const downProb = 100 - upProb

  // 分析看漲/看跌因素
  if (todaySignals.ma10_above_ma20)   factors.bullish.push('MA10 在 MA20 上方（短期趨勢向上）')
  else                                 factors.bearish.push('MA10 在 MA20 下方（短期趨勢向下）')

  if (todaySignals.ma20_above_ma50)   factors.bullish.push('MA20 在 MA50 上方（中期趨勢向上）')
  else                                 factors.bearish.push('MA20 在 MA50 下方（中期趨勢向下）')

  if (todaySignals.price_above_ma20)  factors.bullish.push('股價站上 MA20')
  else                                 factors.bearish.push('股價跌破 MA20')

  if (todaySignals.price_above_ma50)  factors.bullish.push('股價站上 MA50')
  else                                 factors.bearish.push('股價跌破 MA50')

  const rsiZoneLabels = ['超賣區（RSI < 30）反彈機會高', 'RSI 偏弱（30-50）', 'RSI 強勢（50-70）', '超買區（RSI > 70）回調風險']
  if (todaySignals.rsi_zone === 0)      factors.bullish.push(rsiZoneLabels[0])
  else if (todaySignals.rsi_zone === 1) factors.bearish.push(rsiZoneLabels[1])
  else if (todaySignals.rsi_zone === 2) factors.bullish.push(rsiZoneLabels[2])
  else                                   factors.bearish.push(rsiZoneLabels[3])

  if (todaySignals.macd_bullish)       factors.bullish.push('MACD 多頭（MACD > Signal）')
  else                                  factors.bearish.push('MACD 空頭（MACD < Signal）')

  if (todaySignals.macd_above_zero)    factors.bullish.push('MACD 在零線上方')
  else                                  factors.bearish.push('MACD 在零線下方')

  const bbLabels = ['接近布林下軌（可能超賣反彈）', '布林中下段', '布林中上段', '接近布林上軌（可能過熱回調）']
  if (todaySignals.bb_zone === 0)       factors.bullish.push(bbLabels[0])
  else if (todaySignals.bb_zone === 3)  factors.bearish.push(bbLabels[3])
  else if (todaySignals.bb_zone === 2)  factors.bullish.push(bbLabels[2])
  else                                   factors.bearish.push(bbLabels[1])

  if (todaySignals.mom3_up)            factors.bullish.push('近 3 日動量向上')
  else                                  factors.bearish.push('近 3 日動量向下')

  if (todaySignals.mom5_up)            factors.bullish.push('近 5 日動量向上')
  else                                  factors.bearish.push('近 5 日動量向下')

  // 信心等級
  let confidence
  if (totalSamples >= 30 && Math.abs(upProb - 50) >= 15) confidence = '高'
  else if (totalSamples >= 15) confidence = '中'
  else confidence = '低'

  // 當沖交易建議
  const dayTrade = calcDayTrade(candles, upProb)

  return {
    upProb,
    downProb,
    bullish: upProb >= 50,
    factors,
    samples: totalSamples,
    confidence,
    dayTrade,
  }
}

// ── 🐔 當沖交易價位計算 ──────────────────────────────

function atr(candles, period = 14) {
  const trs = []
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1]
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close))
    trs.push(tr)
  }
  if (trs.length < period) return trs.reduce((a, b) => a + b, 0) / trs.length
  const recent = trs.slice(-period)
  return recent.reduce((a, b) => a + b, 0) / period
}

function calcDayTrade(candles, upProb) {
  const last = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const price = last.close

  // ATR 衡量波動度
  const atrVal = atr(candles)

  // Pivot Points (用前一天的 H/L/C)
  const pivot = (prev.high + prev.low + prev.close) / 3
  const s1 = 2 * pivot - prev.high   // Support 1
  const r1 = 2 * pivot - prev.low    // Resistance 1
  const s2 = pivot - (prev.high - prev.low)
  const r2 = pivot + (prev.high - prev.low)

  // 布林通道
  const closes = candles.map(c => c.close)
  const bb = bollingerBands(closes, 20, 2)
  const bbUpper = bb.upper[bb.upper.length - 1]
  const bbLower = bb.lower[bb.lower.length - 1]
  const bbMid   = bb.mid[bb.mid.length - 1]

  // 5 日最高最低
  const recent5 = candles.slice(-5)
  const high5 = Math.max(...recent5.map(c => c.high))
  const low5  = Math.min(...recent5.map(c => c.low))

  const f = (n) => parseFloat(n.toFixed(2))

  // ── 做多當沖 ──
  // 買進：取 Pivot S1、布林下軌、5日低點 的中間偏保守值
  const longBuy  = f(Math.max(s1, bbLower, price - atrVal * 0.5))
  // 賣出：取 Pivot R1、布林上軌、5日高點 的中間偏保守值
  const longSell = f(Math.min(r1, bbUpper, price + atrVal * 1.2))
  // 停損
  const longStop = f(longBuy - atrVal * 0.5)

  // ── 賣空當沖 ──
  // 賣空進場：取 R1、布林上軌、近期高點的保守值
  const shortSell = f(Math.min(r1, bbUpper, price + atrVal * 0.5))
  // 買回：取 S1、布林下軌、近期低點
  const shortCover = f(Math.max(s1, bbLower, price - atrVal * 1.2))
  // 停損
  const shortStop = f(shortSell + atrVal * 0.5)

  // 預估獲利空間
  const longProfit  = f(((longSell - longBuy) / longBuy) * 100)
  const shortProfit = f(((shortSell - shortCover) / shortCover) * 100)

  return {
    price: f(price),
    atr: f(atrVal),
    pivot: f(pivot),
    long: {
      buy:    longBuy,
      sell:   longSell,
      stop:   longStop,
      profit: longProfit,
      recommended: upProb >= 50,
    },
    short: {
      sell:   shortSell,
      cover:  shortCover,
      stop:   shortStop,
      profit: shortProfit,
      recommended: upProb < 50,
    },
  }
}
