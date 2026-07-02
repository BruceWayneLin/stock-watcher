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

// ── K 線型態偵測 ──────────────────────────────────

function detectCandlePatterns(candles) {
  const patterns = []
  const n = candles.length
  if (n < 3) return patterns

  const last = candles[n - 1]
  const prev = candles[n - 2]

  const bodySize = Math.abs(last.close - last.open)
  const upperShadow = last.high - Math.max(last.open, last.close)
  const lowerShadow = Math.min(last.open, last.close) - last.low
  const totalRange = last.high - last.low
  const prevBody = Math.abs(prev.close - prev.open)

  // 十字線 (Doji)
  if (totalRange > 0 && bodySize / totalRange < 0.1) {
    patterns.push({ name: '十字線', type: 'neutral', desc: '多空拉鋸，留意變盤' })
  }

  // 錘子線 (Hammer)
  if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5 && totalRange > 0) {
    patterns.push({ name: '錘子線', type: 'bullish', desc: '下影線長，買盤承接力道強' })
  }

  // 射擊之星 (Shooting Star)
  if (upperShadow > bodySize * 2 && lowerShadow < bodySize * 0.5 && totalRange > 0) {
    patterns.push({ name: '射擊之星', type: 'bearish', desc: '上影線長，賣壓沉重' })
  }

  // 多頭吞噬 (Bullish Engulfing)
  if (last.close > last.open && prev.close < prev.open &&
      last.open <= prev.close && last.close >= prev.open && bodySize > prevBody) {
    patterns.push({ name: '多頭吞噬', type: 'bullish', desc: '強力反轉看漲訊號' })
  }

  // 空頭吞噬 (Bearish Engulfing)
  if (last.close < last.open && prev.close > prev.open &&
      last.open >= prev.close && last.close <= prev.open && bodySize > prevBody) {
    patterns.push({ name: '空頭吞噬', type: 'bearish', desc: '強力反轉看跌訊號' })
  }

  // 連三紅 / 三黑
  if (n >= 4) {
    const c3 = candles[n - 3]
    const threeUp = c3.close > c3.open && prev.close > prev.open && last.close > last.open
      && prev.close > c3.close && last.close > prev.close
    const threeDown = c3.close < c3.open && prev.close < prev.open && last.close < last.open
      && prev.close < c3.close && last.close < prev.close

    if (threeUp) patterns.push({ name: '三紅兵', type: 'bullish', desc: '連三根紅K，多頭氣勢強' })
    if (threeDown) patterns.push({ name: '三黑鴉', type: 'bearish', desc: '連三根黑K，空頭氣勢強' })
  }

  // 缺口 (Gap)
  if (last.low > prev.high) {
    patterns.push({ name: '跳空上漲', type: 'bullish', desc: '跳空缺口，多頭強勢突破' })
  }
  if (last.high < prev.low) {
    patterns.push({ name: '跳空下跌', type: 'bearish', desc: '跳空缺口，空頭強力殺盤' })
  }

  return patterns
}

// ── 🐔 小雞預測引擎 v2 ────────────────────────────────
// 歷史相似度回測，v2 改進：
//  1. 全部指標序列一次算完（O(n)），不再對每個歷史日重算切片
//  2. 特徵加權相似度：重要特徵（RSI/布林/動量）權重較高
//  3. 動量改連續值（以近期波動度標準化），不再只看正負
//  4. 新增波動度狀態、成交量比兩個特徵
//  5. 樣本權重 = 相似度² × 時間衰減（越近的歷史越有參考性）
//  6. 自適應相似度門檻：先用嚴格門檻，樣本不足才放寬
//  7. 機率經貝氏收縮（依有效樣本數往 50% 收），避免小樣本過度自信

function wilderRsiSeries(closes, period = 14) {
  const out = new Array(closes.length).fill(null)
  if (closes.length < period + 1) return out
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1]
    if (ch > 0) avgGain += ch; else avgLoss -= ch
  }
  avgGain /= period; avgLoss /= period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + (ch > 0 ? ch : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (ch < 0 ? -ch : 0)) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

function atrSeries(candles, period = 14) {
  const n = candles.length
  const out = new Array(n).fill(null)
  if (n < 2) return out
  let sum = 0, atrVal = null
  for (let i = 1; i < n; i++) {
    const c = candles[i], p = candles[i - 1]
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close))
    if (i <= period) {
      sum += tr
      if (i === period) { atrVal = sum / period; out[i] = atrVal }
    } else {
      atrVal = (atrVal * (period - 1) + tr) / period
      out[i] = atrVal
    }
  }
  return out
}

function macdPair(closes) {
  const emaF = ema(closes, 12)
  const emaS = ema(closes, 26)
  const macdLine = closes.map((_, i) =>
    (emaF[i] !== null && emaS[i] !== null) ? emaF[i] - emaS[i] : null)
  const firstValid = macdLine.findIndex(v => v !== null)
  const signalLine = new Array(closes.length).fill(null)
  if (firstValid >= 0) {
    const sig = ema(macdLine.slice(firstValid), 9)
    for (let i = firstValid; i < closes.length; i++) {
      signalLine[i] = sig[i - firstValid] ?? null
    }
  }
  return { macdLine, signalLine }
}

// 近 period 根報酬率標準差（動量標準化用）
function rollingRetStd(closes, period = 20) {
  const n = closes.length
  const out = new Array(n).fill(null)
  for (let i = period; i < n; i++) {
    let mean = 0
    const rets = []
    for (let j = i - period + 1; j <= i; j++) {
      const r = (closes[j] - closes[j - 1]) / closes[j - 1]
      rets.push(r); mean += r
    }
    mean /= period
    out[i] = Math.sqrt(rets.reduce((s, v) => s + (v - mean) ** 2, 0) / period)
  }
  return out
}

// [特徵名, 權重, 連續距離係數（null = 離散精確匹配）]
const FEATURES = [
  ['ma10_gt_ma20',   1,    null],
  ['ma20_gt_ma50',   1,    null],
  ['price_gt_ma20',  1,    null],
  ['price_gt_ma50',  1,    null],
  ['rsi_norm',       1.5,  2.5],
  ['macd_bullish',   1,    null],
  ['macd_above_zero', 0.75, null],
  ['macd_hist',      1,    2],
  ['bb_pos',         1.5,  2.5],
  ['mom3',           1.25, 2.2],
  ['mom5',           1.25, 2.2],
  ['vol_regime',     0.75, 2],
  ['vol_ratio',      0.75, 2],
]

function similarity(a, b) {
  let sim = 0, wsum = 0
  for (const [key, w, k] of FEATURES) {
    const av = a[key], bv = b[key]
    if (av == null || bv == null) continue
    wsum += w
    sim += w * (k === null
      ? (av === bv ? 1 : 0)
      : Math.max(0, 1 - Math.abs(av - bv) * k))
  }
  return wsum ? sim / wsum : 0
}

function buildFeatureMatrix(candles) {
  const n = candles.length
  const closes = candles.map(c => c.close)
  const volumes = candles.map(c => c.volume ?? null)
  const hasVolume = volumes.filter(v => v != null && v > 0).length > n * 0.8

  const ma10 = sma(closes, 10)
  const ma20 = sma(closes, 20)
  const ma50 = sma(closes, 50)
  const rsiArr = wilderRsiSeries(closes)
  const { macdLine, signalLine } = macdPair(closes)
  const bb = bollingerBands(closes, 20, 2)
  const atrArr = atrSeries(candles, 14)
  const retStd = rollingRetStd(closes, 20)
  const volSma = hasVolume ? sma(volumes.map(v => v ?? 0), 20) : null

  // ATR 的 30 根平均（波動度狀態基準）
  const atrAvg = new Array(n).fill(null)
  for (let i = 43; i < n; i++) {
    let s = 0
    for (let j = i - 29; j <= i; j++) s += atrArr[j]
    atrAvg[i] = s / 30
  }

  const clamp01 = v => Math.min(1, Math.max(0, v))
  const squash = (v, scale) => clamp01(0.5 + 0.5 * Math.tanh(v / scale))

  function vecAt(i) {
    if (i < 50) return null
    if (ma10[i] == null || ma20[i] == null || ma50[i] == null ||
        rsiArr[i] == null || macdLine[i] == null || signalLine[i] == null ||
        atrArr[i] == null || retStd[i] == null) return null

    const price = closes[i]
    const bbU = bb.upper[i], bbL = bb.lower[i]
    const std = retStd[i] || 0.01
    const mom3 = (price - closes[i - 3]) / closes[i - 3]
    const mom5 = (price - closes[i - 5]) / closes[i - 5]

    return {
      ma10_gt_ma20:   ma10[i] > ma20[i] ? 1 : 0,
      ma20_gt_ma50:   ma20[i] > ma50[i] ? 1 : 0,
      price_gt_ma20:  price > ma20[i] ? 1 : 0,
      price_gt_ma50:  price > ma50[i] ? 1 : 0,
      rsi_norm:       rsiArr[i] / 100,
      macd_bullish:   macdLine[i] > signalLine[i] ? 1 : 0,
      macd_above_zero: macdLine[i] > 0 ? 1 : 0,
      // MACD 柱狀圖以 ATR 標準化 → 動能「強度」也納入比對
      macd_hist:      squash((macdLine[i] - signalLine[i]) / (atrArr[i] || price * 0.01), 1),
      bb_pos:         bbU !== bbL ? clamp01((price - bbL) / (bbU - bbL)) : 0.5,
      // 動量以近期波動度標準化 → 「漲 2% 在低波動股很強、在高波動股普通」
      mom3:           squash(mom3, std * Math.sqrt(3) * 2),
      mom5:           squash(mom5, std * Math.sqrt(5) * 2),
      vol_regime:     atrAvg[i] ? clamp01(atrArr[i] / atrAvg[i] / 2) : null,
      vol_ratio:      (volSma && volSma[i] > 0 && volumes[i] != null)
                        ? clamp01(volumes[i] / volSma[i] / 2.5) : null,
    }
  }

  return { vecAt }
}

export function predictToday(candles, opts = {}) {
  const unit = opts.unit ?? '日'          // 個股日線 = '日'，分線 = '根K棒'
  const minBars = opts.minBars ?? 60
  const closes = candles.map(c => c.close)
  const n = closes.length
  if (n < minBars) return null

  const todayIdx = n - 1
  const { vecAt } = buildFeatureMatrix(candles)
  const todaySignals = vecAt(todayIdx)
  if (!todaySignals) return null

  // 對歷史每一根算相似度（指標已預算，這裡只是查表 + 距離）
  const cands = []
  for (let i = 50; i < todayIdx; i++) {
    const v = vecAt(i)
    if (!v) continue
    cands.push({
      i,
      sim: similarity(todaySignals, v),
      ret: ((closes[i + 1] - closes[i]) / closes[i]) * 100,
    })
  }

  // 自適應門檻：優先用嚴格門檻，樣本不足才逐步放寬
  const THRESHOLDS = [0.85, 0.8, 0.75, 0.7]
  let matches = []
  let thrUsed = THRESHOLDS[THRESHOLDS.length - 1]
  for (const thr of THRESHOLDS) {
    const m = cands.filter(c => c.sim >= thr)
    if (m.length >= 25) { matches = m; thrUsed = thr; break }
  }
  if (!matches.length) matches = cands.filter(c => c.sim >= thrUsed)
  if (matches.length < 5) return null  // 樣本太少不預測

  // 樣本權重 = 相似度² × 時間衰減（半衰期 60 根）
  const HALF_LIFE = 60
  let weightedUp = 0, totalWeight = 0, wSqSum = 0
  let totalUp = 0, totalDown = 0
  const nextDayReturns = []
  for (const m of matches) {
    const decay = Math.pow(0.5, (todayIdx - 1 - m.i) / HALF_LIFE)
    const w = m.sim * m.sim * decay
    totalWeight += w
    wSqSum += w * w
    nextDayReturns.push(m.ret)
    if (m.ret > 0) { weightedUp += w; totalUp++ } else { totalDown++ }
  }

  const totalSamples = totalUp + totalDown
  const factors = { bullish: [], bearish: [] }

  // 有效樣本數（權重分佈越集中，有效樣本越少）＋ 貝氏收縮
  const effN = (totalWeight * totalWeight) / wSqSum
  const pRaw = weightedUp / totalWeight
  const shrink = effN / (effN + 8)
  let upProb = Math.round((0.5 + (pRaw - 0.5) * shrink) * 100)
  upProb = Math.min(95, Math.max(5, upProb))
  const downProb = 100 - upProb

  // ── 歷史回報統計（精準度核心）──
  const upRets = nextDayReturns.filter(r => r > 0).sort((a, b) => a - b)
  const downRetsArr = nextDayReturns.filter(r => r <= 0).sort((a, b) => a - b)
  const winRate = Math.round((totalUp / totalSamples) * 100)
  const avgUpPct = upRets.length ? +(upRets.reduce((a, b) => a + b, 0) / upRets.length).toFixed(2) : 0
  const avgDownPct = downRetsArr.length ? +(downRetsArr.reduce((a, b) => a + b, 0) / downRetsArr.length).toFixed(2) : 0
  const maxUpPct = upRets.length ? +upRets[upRets.length - 1].toFixed(2) : 0
  const p75UpPct = upRets.length >= 4 ? +upRets[Math.floor(upRets.length * 0.75)].toFixed(2) : avgUpPct
  const maxDownPct = downRetsArr.length ? +downRetsArr[0].toFixed(2) : 0
  const p25DownPct = downRetsArr.length >= 4 ? +downRetsArr[Math.floor(downRetsArr.length * 0.25)].toFixed(2) : avgDownPct

  const currentPrice = closes[todayIdx]
  const stats = {
    winRate, totalUp, totalDown,
    avgUpPct, avgDownPct, maxUpPct, maxDownPct, p75UpPct, p25DownPct,
    currentPrice: +currentPrice.toFixed(2),
    targetPrice: +(currentPrice * (1 + p75UpPct / 100)).toFixed(2),
    maxPrice: +(currentPrice * (1 + maxUpPct / 100)).toFixed(2),
    riskPrice: +(currentPrice * (1 + avgDownPct / 100)).toFixed(2),
  }

  // 分析看漲/看跌因素
  if (todaySignals.ma10_gt_ma20)      factors.bullish.push('MA10 在 MA20 上方（短期趨勢向上）')
  else                                 factors.bearish.push('MA10 在 MA20 下方（短期趨勢向下）')

  if (todaySignals.ma20_gt_ma50)      factors.bullish.push('MA20 在 MA50 上方（中期趨勢向上）')
  else                                 factors.bearish.push('MA20 在 MA50 下方（中期趨勢向下）')

  if (todaySignals.price_gt_ma20)     factors.bullish.push('股價站上 MA20')
  else                                 factors.bearish.push('股價跌破 MA20')

  if (todaySignals.price_gt_ma50)     factors.bullish.push('股價站上 MA50')
  else                                 factors.bearish.push('股價跌破 MA50')

  // RSI（連續值 → 更精準的判斷）
  const rsiPct = todaySignals.rsi_norm * 100
  if (rsiPct < 30)      factors.bullish.push(`超賣區（RSI ${rsiPct.toFixed(0)}）反彈機會高`)
  else if (rsiPct < 50) factors.bearish.push(`RSI 偏弱（${rsiPct.toFixed(0)}）`)
  else if (rsiPct < 70) factors.bullish.push(`RSI 強勢（${rsiPct.toFixed(0)}）`)
  else                   factors.bearish.push(`超買區（RSI ${rsiPct.toFixed(0)}）回調風險`)

  if (todaySignals.macd_bullish)       factors.bullish.push('MACD 多頭（MACD > Signal）')
  else                                  factors.bearish.push('MACD 空頭（MACD < Signal）')

  if (todaySignals.macd_above_zero)    factors.bullish.push('MACD 在零線上方')
  else                                  factors.bearish.push('MACD 在零線下方')

  // 布林通道（連續值）
  const bbp = todaySignals.bb_pos
  if (bbp < 0.2)       factors.bullish.push('接近布林下軌（可能超賣反彈）')
  else if (bbp >= 0.8)  factors.bearish.push('接近布林上軌（可能過熱回調）')
  else if (bbp >= 0.5)  factors.bullish.push('布林中上段')
  else                   factors.bearish.push('布林中下段')

  // 動量（連續值，0.5 = 持平；偏離越多力道越強）
  if (todaySignals.mom3 > 0.58)        factors.bullish.push(`近 3 ${unit}動量向上`)
  else if (todaySignals.mom3 < 0.42)   factors.bearish.push(`近 3 ${unit}動量向下`)

  if (todaySignals.mom5 > 0.58)        factors.bullish.push(`近 5 ${unit}動量向上`)
  else if (todaySignals.mom5 < 0.42)   factors.bearish.push(`近 5 ${unit}動量向下`)

  // 成交量（量價配合）
  if (todaySignals.vol_ratio != null && todaySignals.vol_ratio > 0.6) {
    if (closes[todayIdx] > closes[todayIdx - 1]) factors.bullish.push('價漲量增（買盤積極）')
    else factors.bearish.push('價跌量增（賣壓沉重）')
  }

  // 波動度狀態（放大時訊號可靠度下降）
  if (todaySignals.vol_regime != null && todaySignals.vol_regime > 0.75) {
    factors.bearish.push('波動度明顯放大，追價風險升高')
  }

  // ── K 線型態加入因素 ──
  const patterns = detectCandlePatterns(candles)
  for (const p of patterns) {
    if (p.type === 'bullish') factors.bullish.push(`${p.name}：${p.desc}`)
    else if (p.type === 'bearish') factors.bearish.push(`${p.name}：${p.desc}`)
    else {
      factors.bullish.push(`${p.name}：${p.desc}`)
      factors.bearish.push(`${p.name}：${p.desc}`)
    }
  }

  // 信心等級：有效樣本數 + 機率幅度 + 加權/未加權方向一致性
  const rawWinDir = (totalUp / totalSamples) >= 0.5
  const weightedDir = pRaw >= 0.5
  const dirAgree = rawWinDir === weightedDir  // 加權與未加權結論一致才可信
  const margin = Math.abs(upProb - 50)
  const hasStrongPattern = patterns.some(p =>
    ['多頭吞噬', '空頭吞噬', '三紅兵', '三黑鴉', '跳空上漲', '跳空下跌'].includes(p.name))

  let confidence
  if (effN >= 20 && margin >= 12 && dirAgree) confidence = '高'
  else if ((effN >= 10 && margin >= 6 && dirAgree) || (hasStrongPattern && effN >= 8)) confidence = '中'
  else confidence = '低'

  // 當沖交易建議
  const dayTrade = calcDayTrade(candles, upProb, stats)

  return {
    upProb,
    downProb,
    bullish: upProb >= 50,
    factors,
    samples: totalSamples,
    effSamples: Math.round(effN),
    threshold: thrUsed,
    confidence,
    dayTrade,
    stats,
    patterns,
    unit,
  }
}

// ── 📏 Walk-forward 實測命中率 ────────────────────────
// 對最近 evalBars 根，每根只用「當時看得到的歷史」做預測，再和下一根實際漲跌對答案。
// 這是預測到底準不準的即時證據；rate < 52% 代表該標的/週期目前訊號 ≈ 雜訊。

export function walkForwardHitRate(candles, opts = {}) {
  const { unit = '日', evalBars = 80, neutralMargin = 8 } = opts
  const start = Math.max(120, candles.length - evalBars)
  if (candles.length - 1 <= start) return null

  let hits = 0, total = 0, gatedHits = 0, gatedTotal = 0
  for (let t = start; t < candles.length - 1; t++) {
    const p = predictToday(candles.slice(0, t + 1), { unit, minBars: 60 })
    if (!p) continue
    const hit = (p.upProb >= 50) === (candles[t + 1].close > candles[t].close)
    total++
    if (hit) hits++
    if (Math.abs(p.upProb - 50) >= neutralMargin) {
      gatedTotal++
      if (hit) gatedHits++
    }
  }
  if (total < 20) return null

  return {
    rate: Math.round((hits / total) * 100),
    total,
    gatedRate: gatedTotal >= 10 ? Math.round((gatedHits / gatedTotal) * 100) : null,
    gatedTotal,
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

function calcDayTrade(candles, upProb, stats = {}) {
  const last = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const price = last.close

  // ATR 衡量波動度
  const atrVal = atr(candles)

  // Pivot Points (用前一天的 H/L/C)
  const pivot = (prev.high + prev.low + prev.close) / 3
  const s1 = 2 * pivot - prev.high
  const r1 = 2 * pivot - prev.low
  const s2 = pivot - (prev.high - prev.low)
  const r2 = pivot + (prev.high - prev.low)

  // 布林通道
  const closes = candles.map(c => c.close)
  const bb = bollingerBands(closes, 20, 2)
  const bbUpper = bb.upper[bb.upper.length - 1]
  const bbLower = bb.lower[bb.lower.length - 1]

  // 5 日最高最低
  const recent5 = candles.slice(-5)
  const high5 = Math.max(...recent5.map(c => c.high))
  const low5  = Math.min(...recent5.map(c => c.low))

  // Fibonacci (20 日波段)
  const recent20 = candles.slice(-20)
  const swingHigh = Math.max(...recent20.map(c => c.high))
  const swingLow  = Math.min(...recent20.map(c => c.low))
  const swingRange = swingHigh - swingLow
  const fibR1 = swingHigh + swingRange * 0.236
  const fibR2 = swingHigh + swingRange * 0.618
  const fibS1 = swingLow - swingRange * 0.236

  const f = (n) => parseFloat(n.toFixed(2))

  // ── 做多當沖 ──
  const longBuy  = f(Math.max(s1, bbLower, price - atrVal * 0.5))
  const longSell = f(Math.min(r1, bbUpper, price + atrVal * 1.2))
  const longStop = f(longBuy - atrVal * 0.5)

  // ── 賣空當沖 ──
  const shortSell  = f(Math.min(r1, bbUpper, price + atrVal * 0.5))
  const shortCover = f(Math.max(s1, bbLower, price - atrVal * 1.2))
  const shortStop  = f(shortSell + atrVal * 0.5)

  // 預估獲利空間
  const longProfit  = f(((longSell - longBuy) / longBuy) * 100)
  const shortProfit = f(((shortSell - shortCover) / shortCover) * 100)

  // ── 目標價（多方法交叉驗證）──
  const upTargets = [longSell, r1, high5].filter(Number.isFinite)
  if (stats.targetPrice) upTargets.push(stats.targetPrice)
  if (Number.isFinite(fibR1)) upTargets.push(fibR1)
  upTargets.sort((a, b) => a - b)
  const targetHigh = f(upTargets[Math.floor(upTargets.length / 2)] ?? longSell)

  // 最高可能（樂觀上限）
  const maxCandidates = [r2, high5 + atrVal * 0.5].filter(Number.isFinite)
  if (stats.maxPrice) maxCandidates.push(stats.maxPrice)
  if (Number.isFinite(fibR2)) maxCandidates.push(fibR2)
  if (Number.isFinite(bbUpper)) maxCandidates.push(bbUpper * 1.01)
  maxCandidates.sort((a, b) => a - b)
  const maxPossible = f(maxCandidates[Math.floor(maxCandidates.length / 2)] ?? r2)

  // 最低可能（悲觀下限）
  const minCandidates = [s2, low5 - atrVal * 0.5].filter(Number.isFinite)
  if (stats.riskPrice) minCandidates.push(stats.riskPrice)
  if (Number.isFinite(fibS1)) minCandidates.push(fibS1)
  if (Number.isFinite(bbLower)) minCandidates.push(bbLower * 0.99)
  minCandidates.sort((a, b) => a - b)
  const minPossible = f(minCandidates[Math.floor(minCandidates.length / 2)] ?? s2)

  // 風報比
  const reward = targetHigh - longBuy
  const risk = longBuy - longStop
  const riskReward = risk > 0 ? f(reward / risk) : 0

  // ── 操作建議（嚴格門檻 + 波動度調整）──
  const volPct = f((atrVal / price) * 100)  // ATR 佔股價 %
  const isHighVol = volPct > 3              // 日均波動 >3% = 高波動
  const wr = stats.winRate ?? 50
  const sampleCount = (stats.totalUp ?? 0) + (stats.totalDown ?? 0)

  let action, actionLabel
  // 「強力」需要三重確認：機率 + 勝率 + 樣本數，且不能是高波動股
  if (upProb >= 70 && wr >= 65 && sampleCount >= 25 && !isHighVol) {
    action = 'strong_buy'; actionLabel = '技術面強力看多'
  } else if (upProb >= 58 && wr >= 53) {
    action = 'buy'; actionLabel = '技術面偏多'
  } else if (upProb <= 30 && (100 - wr) >= 65 && sampleCount >= 25 && !isHighVol) {
    action = 'strong_sell'; actionLabel = '技術面強力看空'
  } else if (upProb <= 42 && (100 - wr) >= 53) {
    action = 'sell'; actionLabel = '技術面偏空'
  } else {
    action = 'neutral'; actionLabel = '多空不明，建議觀望'
  }

  // 高波動股自動降級（CIFR、MSTR 這類股不該給強力推薦）
  if (isHighVol) {
    if (action === 'strong_buy') { action = 'buy'; actionLabel = '偏多（高波動注意）' }
    else if (action === 'strong_sell') { action = 'sell'; actionLabel = '偏空（高波動注意）' }
    else if (action === 'buy') { actionLabel = '技術面偏多（高波動）' }
    else if (action === 'sell') { actionLabel = '技術面偏空（高波動）' }
  }

  return {
    price: f(price),
    atr: f(atrVal),
    pivot: f(pivot),
    targetHigh,
    maxPossible,
    minPossible,
    riskReward,
    action,
    actionLabel,
    volPct,
    isHighVol,
    long: {
      buy: longBuy, sell: longSell, stop: longStop, profit: longProfit,
      recommended: upProb >= 50,
    },
    short: {
      sell: shortSell, cover: shortCover, stop: shortStop, profit: shortProfit,
      recommended: upProb < 50,
    },
  }
}
