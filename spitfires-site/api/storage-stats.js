import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const MEDIA_LIMIT_BYTES = 800 * 1024 * 1024 // 800 MB

async function requireAuth(req, res) {
  const token = req.headers['x-admin-token'] ?? ''
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null }
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_SERVICE_KEY },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body?.id) { res.status(401).json({ error: 'Unauthorized' }); return null }
  return body
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!await requireAuth(req, res)) return

  // Get all album IDs so we can list each folder in the media bucket
  const { data: albums, error: albumsError } = await supabase
    .from('media_albums')
    .select('id')

  if (albumsError) {
    return res.status(500).json({ error: 'Failed to fetch storage stats' })
  }

  const listResults = await Promise.all(
    (albums || []).map(album => supabase.storage.from('media').list(album.id, { limit: 10000 }))
  )
  let usedBytes = 0
  for (const { data: files } of listResults) {
    for (const file of files || []) {
      usedBytes += file.metadata?.size ?? 0
    }
  }

  res.status(200).json({ usedBytes, limitBytes: MEDIA_LIMIT_BYTES })
}
