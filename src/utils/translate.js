// ── 新聞翻譯（Google Translate 免費端點）──

const cache = new Map()

async function translateText(text, from = 'en', to = 'zh-TW') {
  if (!text || text.length < 3) return text
  const key = `${from}|${to}|${text}`
  if (cache.has(key)) return cache.get(key)

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`
    const res = await fetch(url)
    if (!res.ok) return text
    const data = await res.json()
    // 回傳格式：[[["翻譯","原文",...],...],"en"]
    const translated = data[0].map(s => s[0]).join('')
    if (translated) {
      cache.set(key, translated)
      return translated
    }
    return text
  } catch {
    return text
  }
}

/**
 * 翻譯新聞列表的 headline 和 summary
 * 翻譯完的欄位存在 headlineTw / summaryTw
 */
export async function translateNewsItems(items) {
  if (!items?.length) return items

  const results = await Promise.allSettled(
    items.map(async (item) => {
      const [headlineTw, summaryTw] = await Promise.all([
        translateText(item.headline || ''),
        item.summary ? translateText(item.summary.slice(0, 200)) : Promise.resolve(''),
      ])
      return { ...item, headlineTw, summaryTw }
    })
  )

  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : items[i]
  )
}
