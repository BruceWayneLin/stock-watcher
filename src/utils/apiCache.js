// ── 客戶端 API 快取 ──────────────────────────────────

const memCache = new Map()
const DEFAULT_TTL = 30 * 60 * 1000 // 30 分鐘

export async function cachedFetch(url, ttl = DEFAULT_TTL) {
  const key = hashKey(url)

  const mem = memCache.get(key)
  if (mem && Date.now() - mem.ts < ttl) return mem.data

  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Date.now() - parsed.ts < ttl) {
        memCache.set(key, parsed)
        return parsed.data
      }
      localStorage.removeItem(key)
    }
  } catch { /* ignore */ }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()

  const entry = { data, ts: Date.now() }
  memCache.set(key, entry)
  try {
    localStorage.setItem(key, JSON.stringify(entry))
  } catch { /* quota exceeded */ }

  return data
}

/**
 * 嘗試多個 URL，第一個成功就回傳
 */
export async function cachedFetchWithFallback(urls, ttl = DEFAULT_TTL) {
  let lastErr
  for (const url of urls) {
    try {
      return await cachedFetch(url, ttl)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

function hashKey(url) {
  let h = 0
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) - h + url.charCodeAt(i)) | 0
  }
  return 'c_' + (h >>> 0).toString(36)
}

export function clearCache() {
  memCache.clear()
  const toRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith('c_')) toRemove.push(k)
  }
  toRemove.forEach(k => localStorage.removeItem(k))
}
