import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const MEDIA_LIMIT_BYTES = 800 * 1024 * 1024 // 800 MB

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get all album IDs so we can list each folder in the media bucket
  const { data: albums, error: albumsError } = await supabase
    .from('media_albums')
    .select('id')

  if (albumsError) {
    return res.status(500).json({ error: albumsError.message })
  }

  let usedBytes = 0
  for (const album of albums || []) {
    const { data: files } = await supabase.storage
      .from('media')
      .list(album.id, { limit: 10000 })
    for (const file of files || []) {
      usedBytes += file.metadata?.size ?? 0
    }
  }

  res.status(200).json({ usedBytes, limitBytes: MEDIA_LIMIT_BYTES })
}
