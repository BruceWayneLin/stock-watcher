export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const target = url.searchParams.get('url')

    if (!target) {
      return new Response('Missing url parameter', { status: 400 })
    }

    // 先查 Cloudflare edge cache
    const cache    = caches.default
    const cacheKey = new Request(target)
    const cached   = await cache.match(cacheKey)
    if (cached) {
      const body = await cached.text()
      return new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // 最多 retry 3 次（429 時等待後重試）
    let res
    for (let i = 0; i < 3; i++) {
      res = await fetch(target, {
        headers: { 'Accept': 'application/json' },
      })
      if (res.status !== 429) break
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }

    const body = await res.text()

    const response = new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })

    // 成功才快取，TTL 15 分鐘
    if (res.status === 200) {
      const toCache = response.clone()
      ctx.waitUntil(
        cache.put(cacheKey, new Response(body, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=900',
          },
        }))
      )
    }

    return response
  },
}
