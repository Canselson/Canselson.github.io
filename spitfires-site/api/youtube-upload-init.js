import { createClient } from '@supabase/supabase-js'

async function requireAuth(req, res) {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '')
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) { res.status(401).json({ error: 'Unauthorized' }); return null }
  return user
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!await requireAuth(req, res)) return

  const { title, contentType = 'video/mp4' } = req.body
  if (!title) return res.status(400).json({ error: 'Title is required' })

  // Exchange refresh token for a short-lived access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return res.status(500).json({ error: 'Failed to get YouTube access token — check env vars' })
  }

  // Initiate a resumable upload session — YouTube returns a pre-authenticated upload URL
  const uploadInitRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        'Authorization':         `Bearer ${tokenData.access_token}`,
        'Content-Type':          'application/json',
        'X-Upload-Content-Type': contentType,
      },
      body: JSON.stringify({
        snippet: { title },
        status:  { privacyStatus: 'unlisted' },
      }),
    }
  )

  if (!uploadInitRes.ok) {
    const errData = await uploadInitRes.json().catch(() => ({}))
    return res.status(500).json({
      error: errData.error?.message || `YouTube API error (${uploadInitRes.status})`,
    })
  }

  const uploadUrl = uploadInitRes.headers.get('location')
  if (!uploadUrl) {
    return res.status(500).json({ error: 'YouTube did not return an upload URL' })
  }

  res.status(200).json({ uploadUrl })
}
