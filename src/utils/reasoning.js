// ── 推理引擎：整合技術面 + 新聞 + 預測，輸出完整推理鏈 ──

// 新聞情緒關鍵字（簡易版）
const BEARISH_KW = [
  'crash', 'plunge', 'tumble', 'selloff', 'sell-off', 'downturn', 'recession',
  'layoff', 'cut', 'miss', 'decline', 'warning', 'fear', 'risk', 'crisis',
  'bankruptcy', 'default', 'downgrade', 'loss', 'weak', 'slump', 'drop',
  'tariff', 'war', 'sanctions', 'investigation', 'fraud', 'lawsuit',
  'bear', 'negative', 'concern', 'worst', 'low', 'fall', 'fell', 'sink',
]
const BULLISH_KW = [
  'surge', 'rally', 'jump', 'soar', 'boom', 'upgrade', 'beat', 'record',
  'growth', 'gain', 'profit', 'strong', 'bullish', 'optimism', 'recovery',
  'breakout', 'high', 'buy', 'outperform', 'raise', 'dividend', 'expand',
  'innovation', 'partnership', 'deal', 'approval', 'launch', 'revenue',
  'bull', 'positive', 'best', 'rise', 'up', 'above',
]

export function analyzeNewsSentiment(newsItems) {
  if (!newsItems || !newsItems.length) {
    return { score: 0, total: 0, bullishCount: 0, bearishCount: 0, neutralCount: 0, highlights: [] }
  }

  let bullishCount = 0
  let bearishCount = 0
  let neutralCount = 0
  const highlights = []

  for (const item of newsItems) {
    const text = ((item.headline || '') + ' ' + (item.summary || '')).toLowerCase()
    let bull = 0, bear = 0

    for (const kw of BULLISH_KW) {
      if (text.includes(kw)) bull++
    }
    for (const kw of BEARISH_KW) {
      if (text.includes(kw)) bear++
    }

    if (bull > bear) {
      bullishCount++
      if (highlights.length < 2) highlights.push({ text: item.headline, sentiment: 'bullish' })
    } else if (bear > bull) {
      bearishCount++
      if (highlights.length < 2) highlights.push({ text: item.headline, sentiment: 'bearish' })
    } else {
      neutralCount++
    }
  }

  const total = newsItems.length
  // -1 到 +1 的情緒分數
  const score = total > 0 ? (bullishCount - bearishCount) / total : 0

  return { score, total, bullishCount, bearishCount, neutralCount, highlights }
}

function analyzeTechnicals(taData) {
  if (!taData) return null

  const steps = []
  let bullPoints = 0
  let bearPoints = 0

  // 趨勢分析
  const signals = taData.signals || []
  if (signals.includes('MA10>MA20')) {
    steps.push({ label: '短期趨勢', value: 'MA10 > MA20，短線向上', type: 'bull' })
    bullPoints += 1
  } else {
    steps.push({ label: '短期趨勢', value: 'MA10 < MA20，短線偏弱', type: 'bear' })
    bearPoints += 1
  }

  if (signals.includes('黃金交叉')) {
    steps.push({ label: '中期趨勢', value: 'MA20 > MA50 黃金交叉，中線看多', type: 'bull' })
    bullPoints += 2
  } else if (taData.ma20 && taData.ma50 && taData.ma20 < taData.ma50) {
    steps.push({ label: '中期趨勢', value: 'MA20 < MA50 死亡交叉，中線看空', type: 'bear' })
    bearPoints += 2
  }

  // RSI
  const rsiVal = taData.rsi
  if (rsiVal !== undefined && rsiVal !== null) {
    if (rsiVal < 30) {
      steps.push({ label: 'RSI', value: `${rsiVal.toFixed(1)} 超賣區，反彈機率高`, type: 'bull' })
      bullPoints += 2
    } else if (rsiVal < 45) {
      steps.push({ label: 'RSI', value: `${rsiVal.toFixed(1)} 偏弱區`, type: 'bear' })
      bearPoints += 1
    } else if (rsiVal < 55) {
      steps.push({ label: 'RSI', value: `${rsiVal.toFixed(1)} 中性區間`, type: 'neutral' })
    } else if (rsiVal < 70) {
      steps.push({ label: 'RSI', value: `${rsiVal.toFixed(1)} 強勢區`, type: 'bull' })
      bullPoints += 1
    } else {
      steps.push({ label: 'RSI', value: `${rsiVal.toFixed(1)} 超買區，回調風險高`, type: 'bear' })
      bearPoints += 2
    }
  }

  // MACD
  if (signals.includes('MACD交叉')) {
    steps.push({ label: 'MACD', value: '多頭交叉出現，動能轉強', type: 'bull' })
    bullPoints += 2
  } else if (signals.includes('MACD多頭')) {
    steps.push({ label: 'MACD', value: 'MACD > Signal，動能偏多', type: 'bull' })
    bullPoints += 1
  } else {
    steps.push({ label: 'MACD', value: 'MACD < Signal，動能偏空', type: 'bear' })
    bearPoints += 1
  }

  if (signals.includes('MACD>0')) {
    bullPoints += 0.5
  } else {
    bearPoints += 0.5
  }

  // 月報酬
  const monthRet = taData.monthRet
  if (monthRet !== undefined) {
    if (monthRet > 5) {
      steps.push({ label: '月報酬', value: `+${monthRet.toFixed(1)}%，近期強勢但注意追高風險`, type: 'neutral' })
    } else if (monthRet > 0) {
      steps.push({ label: '月報酬', value: `+${monthRet.toFixed(1)}%，溫和上漲`, type: 'bull' })
      bullPoints += 0.5
    } else if (monthRet > -5) {
      steps.push({ label: '月報酬', value: `${monthRet.toFixed(1)}%，小幅回調`, type: 'neutral' })
    } else {
      steps.push({ label: '月報酬', value: `${monthRet.toFixed(1)}%，近期弱勢`, type: 'bear' })
      bearPoints += 1
    }
  }

  // 綜合技術評分
  const score = taData.score ?? 0
  steps.push({ label: '技術評分', value: `${score} / 10`, type: score >= 6 ? 'bull' : score >= 4 ? 'neutral' : 'bear' })

  return { steps, bullPoints, bearPoints, score }
}

export function generateReasoning({ taData, prediction, newsItems, result }) {
  const chain = []  // 推理步驟
  const risks = []  // 風險提示

  // ── Step 1: 讀行情 ──
  const priceInfo = {
    step: 1,
    title: '讀取行情',
    icon: '📊',
    content: null,
  }
  if (result) {
    const direction = result.isUp ? '上漲' : '下跌'
    const pctStr = result.changePct
    priceInfo.content = `${result.symbol} 目前 ${result.currency}${result.price}，今日${direction} ${pctStr}%`

    const pctNum = parseFloat(pctStr)
    if (result.isUp && pctNum > 3) {
      priceInfo.content += '。漲幅較大，留意追高風險。'
      risks.push('今日漲幅已大，追高可能面臨回調')
    } else if (!result.isUp && pctNum > 3) {
      priceInfo.content += '。跌幅顯著，留意是否繼續下探。'
      risks.push('跌幅較大，可能尚未止跌')
    }
  }
  chain.push(priceInfo)

  // ── Step 2: 讀新聞 ──
  const sentiment = analyzeNewsSentiment(newsItems)
  const newsStep = {
    step: 2,
    title: '分析新聞情緒',
    icon: '📰',
    content: null,
    details: [],
  }
  if (sentiment.total > 0) {
    const sentimentLabel = sentiment.score > 0.2 ? '偏多'
      : sentiment.score < -0.2 ? '偏空' : '中性'
    newsStep.content = `分析 ${sentiment.total} 則新聞：${sentiment.bullishCount} 則正面、${sentiment.bearishCount} 則負面、${sentiment.neutralCount} 則中性 → 整體情緒${sentimentLabel}`

    for (const h of sentiment.highlights) {
      newsStep.details.push({
        text: h.text,
        type: h.sentiment === 'bullish' ? 'bull' : 'bear',
      })
    }

    if (sentiment.score < -0.3) {
      risks.push('新聞面明顯偏空，市場情緒負面')
    }
  } else {
    newsStep.content = '無相關新聞資料'
  }
  chain.push(newsStep)

  // ── Step 3: 計算技術指標 ──
  const ta = analyzeTechnicals(taData)
  const taStep = {
    step: 3,
    title: '計算技術指標',
    icon: '🔬',
    content: null,
    indicators: [],
  }
  if (ta) {
    const taDirection = ta.bullPoints > ta.bearPoints ? '偏多'
      : ta.bullPoints < ta.bearPoints ? '偏空' : '中性'
    taStep.content = `多頭訊號 ${ta.bullPoints.toFixed(1)} 分 vs 空頭訊號 ${ta.bearPoints.toFixed(1)} 分 → 技術面${taDirection}`
    taStep.indicators = ta.steps

    if (ta.bearPoints > ta.bullPoints + 3) {
      risks.push('技術面多項指標偏空，下行壓力大')
    }
    if (ta.score <= 2) {
      risks.push('綜合技術評分極低（' + ta.score + '/10），弱勢格局')
    }
  } else {
    taStep.content = '技術指標資料不足'
  }
  chain.push(taStep)

  // ── Step 4: 整合判斷 ──
  const verdictStep = {
    step: 4,
    title: '推理與判斷',
    icon: '🧠',
    content: null,
    verdict: null,
    confidence: null,
  }

  // 計算綜合分數（-10 ~ +10）
  let totalScore = 0

  // 技術面權重 40%
  if (ta) {
    const taDiff = ta.bullPoints - ta.bearPoints
    totalScore += taDiff * 0.8  // 技術面
  }

  // 預測面權重 35%
  if (prediction) {
    const predBias = (prediction.upProb - 50) / 10  // -5 ~ +5
    totalScore += predBias * 0.7
    if (prediction.confidence === '高') totalScore += (predBias > 0 ? 1 : -1) * 0.5
  }

  // 新聞面權重 25%
  totalScore += sentiment.score * 3

  // 判斷
  let verdict, verdictColor, verdictLabel
  if (totalScore >= 3) {
    verdict = 'strong_buy'
    verdictLabel = '強烈看多'
    verdictColor = 'emerald'
  } else if (totalScore >= 1.5) {
    verdict = 'buy'
    verdictLabel = '偏多操作'
    verdictColor = 'emerald'
  } else if (totalScore > -1.5) {
    verdict = 'hold'
    verdictLabel = '觀望為主'
    verdictColor = 'yellow'
  } else if (totalScore > -3) {
    verdict = 'sell'
    verdictLabel = '偏空操作'
    verdictColor = 'red'
  } else {
    verdict = 'strong_sell'
    verdictLabel = '強烈看空'
    verdictColor = 'red'
  }

  // 信心度
  let confidence
  const absScore = Math.abs(totalScore)
  if (absScore >= 3 && ta && prediction && sentiment.total > 0) {
    confidence = '高'
  } else if (absScore >= 1.5) {
    confidence = '中'
  } else {
    confidence = '低'
  }

  // 生成推理描述
  const reasons = []
  if (ta) {
    reasons.push(`技術面${ta.bullPoints > ta.bearPoints ? '偏多' : ta.bullPoints < ta.bearPoints ? '偏空' : '中性'}（${ta.score}/10）`)
  }
  if (prediction) {
    reasons.push(`回測預測${prediction.bullish ? '看漲' : '看跌'} ${prediction.upProb}%`)
  }
  if (sentiment.total > 0) {
    reasons.push(`新聞情緒${sentiment.score > 0.2 ? '正面' : sentiment.score < -0.2 ? '負面' : '中性'}`)
  }

  verdictStep.content = `綜合${reasons.join('、')} → ${verdictLabel}`
  verdictStep.verdict = { label: verdictLabel, color: verdictColor, code: verdict }
  verdictStep.confidence = confidence
  verdictStep.totalScore = totalScore
  chain.push(verdictStep)

  // 通用風險
  risks.push('以上為系統推理，不構成投資建議，請自行判斷')

  return { chain, risks, verdict: verdictStep.verdict, confidence }
}
