export const config = {
  api: { bodyParser: false },
}

async function requireAuth(req, res) {
  const token = req.headers['x-admin-token'] ?? ''
  if (!token) { res.status(401).json({ error: 'Unauthorized', _d: 'no_token' }); return null }
  const url = `${process.env.SUPABASE_URL}/auth/v1/user`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.SUPABASE_SERVICE_KEY,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    res.status(401).json({ error: 'Unauthorized', _d: 'supabase_fail', _s: response.status, _b: body, _hasUrl: !!process.env.SUPABASE_URL, _hasKey: !!process.env.SUPABASE_SERVICE_KEY, _tok10: token.slice(0,10) })
    return null
  }
  if (!body?.id) { res.status(401).json({ error: 'Unauthorized', _d: 'no_id', _b: body }); return null }
  return body
}

const ALLOWED_UPLOAD_HOST = 'www.googleapis.com'

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!await requireAuth(req, res)) return

  const uploadUrl    = req.headers['x-upload-url']
  const contentType  = req.headers['x-content-type'] || 'video/mp4'
  const contentRange = req.headers['content-range']

  if (!uploadUrl)    return res.status(400).json({ error: 'Missing X-Upload-Url header' })
  if (!contentRange) return res.status(400).json({ error: 'Missing Content-Range header' })

  try {
    const parsed = new URL(uploadUrl)
    if (parsed.hostname !== ALLOWED_UPLOAD_HOST) {
      return res.status(400).json({ error: 'Invalid upload URL' })
    }
  } catch {
    return res.status(400).json({ error: 'Malformed upload URL' })
  }

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
