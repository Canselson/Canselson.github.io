export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' })
  }

  const { homeTeamName, awayTeamName, homeScore, awayScore, goals, penalties, homeGoalie, awayGoalie } = req.body

  if (!homeTeamName || homeScore == null || awayScore == null) {
    return res.status(400).json({ error: 'Invalid game data' })
  }

  const prompt = buildPrompt({ homeTeamName, awayTeamName, homeScore, awayScore, goals, penalties, homeGoalie, awayGoalie })

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.75, maxOutputTokens: 700 },
        }),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}))
      return res.status(502).json({ error: err?.error?.message ?? 'Gemini API error' })
    }

    const json = await geminiRes.json()
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (!text) return res.status(502).json({ error: 'Empty response from Gemini' })

    return res.status(200).json({ text: text.trim() })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt({ homeTeamName, awayTeamName, homeScore, awayScore, goals = [], penalties = [], homeGoalie, awayGoalie }) {
  const goalLines = goals.map(g => {
    const team    = g.team === 'home' ? homeTeamName : awayTeamName
    const assists = [g.assist1?.name, g.assist2?.name].filter(Boolean).join(' & ')
    const type    = g.type !== 'E' ? ` [${g.typeLabel}]` : ''
    return `  P${g.period} ${g.periodTime} — ${g.scorer?.name ?? 'Unknown'} (${team})${assists ? `, assists: ${assists}` : ''}${type}`
  }).join('\n') || '  None'

  const penLines = penalties.map(p => {
    const team = p.team === 'home' ? homeTeamName : awayTeamName
    return `  P${p.period} ${p.periodTime} — ${p.player?.name ?? 'Unknown'} (${team}) ${p.offenceCode} ${p.minutes}min`
  }).join('\n') || '  None'

  const goalieLines = [
    homeGoalie ? `  ${homeTeamName}: ${homeGoalie.player?.name ?? 'Unknown'} — ${homeGoalie.saves} saves from ${homeGoalie.totalShots} shots (${homeGoalie.savePercent}% SV%)` : null,
    awayGoalie ? `  ${awayTeamName}: ${awayGoalie.player?.name ?? 'Unknown'} — ${awayGoalie.saves} saves from ${awayGoalie.totalShots} shots (${awayGoalie.savePercent}% SV%)` : null,
  ].filter(Boolean).join('\n') || '  No data'

  return `Write a match report for a university ice hockey club website. Write 2–3 paragraphs in third person. Be enthusiastic but factual. Cover the flow of the game, key scorers, and standout moments. Do not include a headline. Do not use markdown or bullet points — plain text only.

Match: ${homeTeamName} ${homeScore}–${awayScore} ${awayTeamName}

Goals:
${goalLines}

Penalties:
${penLines}

Netminders:
${goalieLines}`
}
