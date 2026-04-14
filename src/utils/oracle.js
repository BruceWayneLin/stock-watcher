function toLocalISODate(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Small, deterministic hash -> 32-bit seed.
function xfnv1a(str) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Deterministic PRNG (fast, good enough for UI randomness).
function mulberry32(seed) {
  let a = seed >>> 0
  return function rand() {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clampInt(n, min, max) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)]
}

function scoreLabel(score) {
  if (score >= 86) return '大吉'
  if (score >= 71) return '吉'
  if (score >= 56) return '小吉'
  if (score >= 41) return '平'
  if (score >= 26) return '小凶'
  return '凶'
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function fmtPct(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return null
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function confBonus(confidence) {
  if (confidence === '高') return 10
  if (confidence === '中') return 5
  return 0
}

function mainProb(prediction) {
  if (!prediction) return null
  return prediction.bullish ? prediction.upProb : prediction.downProb
}

function buildBasis({ taData, prediction }) {
  const basis = []
  if (typeof taData?.score === 'number') basis.push(`技術面綜合評分：${taData.score}/10`)
  if (typeof taData?.monthRet === 'number') basis.push(`近 1 月報酬：${fmtPct(taData.monthRet)}`)
  if (typeof taData?.rsi === 'number') basis.push(`RSI(14)：${taData.rsi.toFixed(0)}`)
  if (prediction?.samples) basis.push(`歷史相似樣本：${prediction.samples} 天`)
  if (prediction?.stats?.winRate != null) basis.push(`歷史勝率：${prediction.stats.winRate}%（${prediction.stats.totalUp}漲/${prediction.stats.totalDown}跌）`)
  if (prediction?.confidence) basis.push(`回測信心：${prediction.confidence}`)
  if (typeof prediction?.upProb === 'number') basis.push(`看漲機率：${prediction.upProb}%`)
  if (typeof prediction?.stats?.avgUpPct === 'number' && prediction.stats.avgUpPct > 0) basis.push(`歷史平均漲幅：+${prediction.stats.avgUpPct}%`)
  if (prediction?.dayTrade?.action) basis.push(`操作建議：${prediction.dayTrade.actionLabel}`)
  return basis
}

function computeTodayLuck({ taData, prediction }) {
  // 今日運勢 = 盤勢順風/可操作性（不是隨機）
  let score = 50

  if (typeof taData?.score === 'number') score += (taData.score / 10) * 25
  if (typeof taData?.monthRet === 'number') score += clamp(taData.monthRet, -25, 25) * 0.4

  const mp = mainProb(prediction)
  if (typeof mp === 'number') score += clamp(mp - 50, -30, 30) * 0.8
  score += confBonus(prediction?.confidence)

  // RSI 極端時容易震盪/反轉，降低順風程度
  if (typeof taData?.rsi === 'number') {
    if (taData.rsi >= 75) score -= 10
    if (taData.rsi <= 25) score -= 6
  }

  if (typeof prediction?.samples === 'number' && prediction.samples < 10) score -= 8

  const final = clampInt(score, 0, 100)
  return { score: final, label: scoreLabel(final) }
}

function computeSideWealth({ prediction }) {
  // 偏財運 = 短線波動帶來的機會（用 dayTrade 的獲利空間/信心衡量）
  if (!prediction?.dayTrade) {
    const fallback = 45 + confBonus(prediction?.confidence)
    const final = clampInt(fallback, 0, 100)
    return { score: final, label: scoreLabel(final) }
  }

  const { dayTrade } = prediction
  const longP = Number(dayTrade.long?.profit)
  const shortP = Number(dayTrade.short?.profit)
  const best = Math.max(
    Number.isFinite(longP) ? Math.abs(longP) : 0,
    Number.isFinite(shortP) ? Math.abs(shortP) : 0
  )

  // 0%~5% 映射到 25~85
  const mapped = 25 + clamp(best, 0, 5) * 12
  const score = mapped + confBonus(prediction?.confidence)

  const final = clampInt(score, 0, 100)
  return { score: final, label: scoreLabel(final) }
}

function buildInvestorAdvice({ taData, prediction }) {
  const advice = []
  const mp = mainProb(prediction)

  if (typeof mp === 'number') {
    if (mp >= 65) advice.push('優勢明顯：可以考慮分批進出，但務必先設定停損/停利。')
    else if (mp >= 55) advice.push('略有優勢：小倉位試單可以，避免追價與重倉。')
    else advice.push('優勢不明：以觀望或極小倉位為主，先等條件更明確。')
  } else {
    advice.push('資料不足：先完成股票分析（需要歷史日線樣本），占卜才有依據。')
  }

  if (typeof taData?.rsi === 'number') {
    if (taData.rsi >= 70) advice.push('RSI 偏高：避免追高，偏向等回檔或用更緊的停損。')
    else if (taData.rsi <= 30) advice.push('RSI 偏低：可能有反彈，但波動大，停損要更嚴格。')
  }

  if (typeof taData?.monthRet === 'number') {
    if (taData.monthRet >= 10) advice.push('近一月漲幅偏大：分批落袋/移動停利，比加碼更重要。')
    else if (taData.monthRet <= -10) advice.push('近一月跌幅偏大：避免急抄底，等趨勢轉強再談加碼。')
  }

  if (prediction?.dayTrade) {
    advice.push('風控：進場前先對照當沖建議的停損價位，停損到就執行。')
  }

  return [...new Set(advice)]
}

function makeAdvice(todayScore, sideScore, rand) {
  const base = []
  if (todayScore >= 71) base.push('今天適合把想做的事情推進一小步。')
  else if (todayScore >= 41) base.push('今天穩穩來就好，別硬拚。')
  else base.push('今天先保守、把風險降到最低。')

  if (sideScore >= 71) base.push('偏財運不錯：小確幸、臨時好消息的機率高。')
  else if (sideScore >= 41) base.push('偏財運普通：有機會但別期待太多。')
  else base.push('偏財運偏弱：避免衝動消費或高風險下注。')

  const extra = [
    '先做最重要的 1 件事，其它延後。',
    '跟一個你信任的人聊聊，會有靈感。',
    '把訊息/待辦清一輪，心情會變好。',
    '別熬夜，睡飽比任何加成都實在。',
    '出門前整理一下包包/桌面，運氣會順一點。',
  ]
  base.push(pick(rand, extra))
  return base
}

export function getDailyOracle(name = '', date = new Date()) {
  const dateKey = toLocalISODate(date)
  const normalized = String(name ?? '').trim().toLowerCase()
  const seed = xfnv1a(`chicken-oracle|${dateKey}|${normalized}`)
  const rand = mulberry32(seed)

  const todayLuck = clampInt(20 + rand() * 80, 0, 100)
  // Keep side wealth a bit more volatile.
  const sideWealth = clampInt(15 + rand() * 85, 0, 100)

  const colors = ['藍', '紫', '綠', '白', '黑', '金', '橘', '粉']
  const luckyColor = pick(rand, colors)
  const luckyNumber = clampInt(1 + rand() * 99, 1, 99)

  return {
    dateKey,
    name: normalized ? name.trim() : '',
    todayLuck: { score: todayLuck, label: scoreLabel(todayLuck) },
    sideWealth: { score: sideWealth, label: scoreLabel(sideWealth) },
    luckyColor,
    luckyNumber,
    advice: makeAdvice(todayLuck, sideWealth, rand),
  }
}

export function getInvestmentOracle({ taData = null, prediction = null, result = null } = {}) {
  const dateKey = toLocalISODate(new Date())
  const symbol = result?.symbol ?? null

  return {
    dateKey,
    symbol,
    todayLuck: computeTodayLuck({ taData, prediction }),
    sideWealth: computeSideWealth({ prediction }),
    basis: buildBasis({ taData, prediction }),
    advice: buildInvestorAdvice({ taData, prediction }),
  }
}

