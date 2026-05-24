import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const [objectsResult, bucketResult] = await Promise.all([
    supabase.schema('storage').from('objects').select('metadata').eq('bucket_id', 'media'),
    supabase.schema('storage').from('buckets').select('max_size').eq('id', 'media').single(),
  ])

  if (objectsResult.error) {
    return res.status(500).json({ error: objectsResult.error.message })
  }

  const usedBytes = (objectsResult.data || []).reduce((sum, obj) => {
    return sum + parseInt(obj.metadata?.size ?? 0, 10)
  }, 0)

  const limitBytes = bucketResult.data?.max_size ?? null

  res.status(200).json({ usedBytes, limitBytes })
}
