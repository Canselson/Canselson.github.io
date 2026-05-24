export const config = {
  api: { bodyParser: false },
}

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const uploadUrl    = req.headers['x-upload-url']
  const contentType  = req.headers['x-content-type'] || 'video/mp4'
  const contentRange = req.headers['content-range']

  if (!uploadUrl)    return res.status(400).json({ error: 'Missing X-Upload-Url header' })
  if (!contentRange) return res.status(400).json({ error: 'Missing Content-Range header' })

  // Buffer the incoming chunk
  const buffers = []
  for await (const chunk of req) buffers.push(chunk)
  const body = Buffer.concat(buffers)

  // Forward to YouTube server-side — no CORS restriction
  const ytRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type':   contentType,
      'Content-Range':  contentRange,
      'Content-Length': String(body.length),
    },
    body,
  })

  if (ytRes.status === 308) {
    // Intermediate chunk accepted — more chunks needed
    return res.status(200).json({ status: 'incomplete', range: ytRes.headers.get('range') })
  }

  if (ytRes.status === 200 || ytRes.status === 201) {
    const data = await ytRes.json()
    return res.status(200).json({ status: 'complete', videoId: data.id })
  }

  const err = await ytRes.json().catch(() => ({}))
  return res.status(500).json({ error: err.error?.message || `YouTube error (${ytRes.status})` })
}
