export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured' })
  }

  const { image, mimeType, team } = req.body
  if (!image || !team) {
    return res.status(400).json({ error: 'image and team are required' })
  }

  // Determine current academic year so the AI can assign correct years to bare dates
  const now    = new Date()
  const month  = now.getMonth() // 0-indexed; Aug = 7
  const year   = now.getFullYear()
  const seasonStartYear = month >= 7 ? year : year - 1

  const prompt =
    `You are extracting ice hockey fixture dates from an image of a fixture list for the ${team} team.\n\n` +
    `Current academic season: ${seasonStartYear}/${seasonStartYear + 1}. ` +
    `Fixtures from September–December belong to year ${seasonStartYear}. ` +
    `Fixtures from January–July belong to year ${seasonStartYear + 1}.\n\n` +
    `Return ONLY a valid JSON array — no markdown, no explanation, no code fences. ` +
    `Each element must have these fields:\n` +
    `  "date"     : "YYYY-MM-DD"\n` +
    `  "time"     : "HH:MM" (24-hour; use "19:00" if not shown)\n` +
    `  "opponent" : string (the opposing team name only, without "vs")\n` +
    `  "home_away": "home" or "away"\n` +
    `  "location" : string or null\n\n` +
    `Example output:\n` +
    `[{"date":"${seasonStartYear}-10-05","time":"18:00","opponent":"Bristol","home_away":"home","location":"Planet Ice Southampton"},` +
    `{"date":"${seasonStartYear}-10-19","time":"19:30","opponent":"Exeter","home_away":"away","location":null}]`

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              {
                type:      'image_url',
                image_url: { url: `data:${mimeType ?? 'image/jpeg'};base64,${image}` },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens:  1500,
      }),
    })

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}))
      return res.status(502).json({ error: err?.error?.message ?? 'Groq API error' })
    }

    const json = await groqRes.json()
    const raw  = json.choices?.[0]?.message?.content ?? ''

    // Strip markdown code fences if the model added them anyway
    const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()

    let fixtures
    try {
      fixtures = JSON.parse(cleaned)
    } catch {
      return res.status(502).json({ error: 'Model returned unparseable JSON', raw })
    }

    if (!Array.isArray(fixtures)) {
      return res.status(502).json({ error: 'Expected a JSON array', raw })
    }

    // Normalise and validate each row — drop anything unrecoverable
    const normalised = fixtures
      .map(f => ({
        date:      String(f.date     ?? '').trim(),
        time:      String(f.time     ?? '19:00').trim(),
        opponent:  String(f.opponent ?? '').trim(),
        home_away: f.home_away === 'home' ? 'home' : 'away',
        location:  f.location ? String(f.location).trim() : '',
      }))
      .filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f.date) && f.opponent)

    return res.status(200).json({ fixtures: normalised })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
