export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const target = url.searchParams.get('url')

    if (!target) {
      return new Response('Missing url parameter', { status: 400 })
    }

    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }

    // 先查 Cloudflare edge cache
    const cache    = caches.default
    const cacheKey = new Request(target)
    const cached   = await cache.match(cacheKey)
    if (cached) {
      const body = await cached.text()
      return new Response(body, { headers: corsHeaders })
    }

    // 最多 retry 5 次（429 時指數退避）
    let res
    for (let i = 0; i < 5; i++) {
      res = await fetch(target, {
        headers: { 'Accept': 'application/json' },
      })
      if (res.status !== 429) break
      // 3s, 6s, 12s, 24s 退避
      await new Promise(r => setTimeout(r, 3000 * Math.pow(2, i)))
    }

    const body = await res.text()

    const response = new Response(body, {
      status: res.status,
      headers: corsHeaders,
    })

    // 成功才快取，TTL 30 分鐘
    if (res.status === 200) {
      ctx.waitUntil(
        cache.put(cacheKey, new Response(body, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=1800',
          },
        }))
      )
    }

    return response
  },
}
