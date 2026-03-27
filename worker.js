export default {
  async fetch(request) {
    const url = new URL(request.url)
    const target = url.searchParams.get('url')

    if (!target) {
      return new Response('Missing url parameter', { status: 400 })
    }

    const res = await fetch(target, {
      headers: { 'Accept': 'application/json' },
    })

    const body = await res.text()

    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  },
}
