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

  const { data, error } = await supabase
    .schema('storage')
    .from('objects')
    .select('metadata')
    .eq('bucket_id', 'media')

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const usedBytes = (data || []).reduce((sum, obj) => {
    return sum + parseInt(obj.metadata?.size ?? 0, 10)
  }, 0)

  res.status(200).json({ usedBytes, limitBytes: MEDIA_LIMIT_BYTES })
}
