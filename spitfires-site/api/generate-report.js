export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured' })
  }

  const { homeTeamName, awayTeamName, homeScore, awayScore, goals, penalties, homeGoalie, awayGoalie } = req.body

  if (!homeTeamName || homeScore == null || awayScore == null) {
    return res.status(400).json({ error: 'Invalid game data' })
  }

  const prompt = buildPrompt({ homeTeamName, awayTeamName, homeScore, awayScore, goals, penalties, homeGoalie, awayGoalie })

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages:    [{ role: 'user', content: prompt }],
        temperature: 0.75,
        max_tokens:  700,
      }),
    })

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}))
      return res.status(502).json({ error: err?.error?.message ?? 'Groq API error' })
    }

    const json = await groqRes.json()
    const text = json.choices?.[0]?.message?.content ?? ''

    if (!text) return res.status(502).json({ error: 'Empty response from Groq' })

    return res.status(200).json({ text: text.trim() })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt({ homeTeamName, awayTeamName, homeScore, awayScore, goals = [], penalties = [], homeGoalie, awayGoalie }) {
  const spitfiresHome = /spitfire/i.test(homeTeamName)
  const spitfiresName = spitfiresHome ? homeTeamName : awayTeamName
  const opponentName  = spitfiresHome ? awayTeamName : homeTeamName
  const spitfiresScore = spitfiresHome ? homeScore : awayScore
  const opponentScore  = spitfiresHome ? awayScore : homeScore
  const result = spitfiresScore > opponentScore ? 'win' : spitfiresScore < opponentScore ? 'loss' : 'draw'

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

  const resultContext = result === 'win'
    ? `The Spitfires won ${spitfiresScore}–${opponentScore}. Open with an upbeat, celebratory tone.`
    : result === 'loss'
    ? `The Spitfires lost ${spitfiresScore}–${opponentScore}. Open with an honest but respectful acknowledgement of the defeat.`
    : `The match ended in a ${spitfiresScore}–${opponentScore} draw. Open by noting the hard-fought point.`

  return `Write a match report for the Southampton Spitfires university ice hockey club website. Write 2–3 paragraphs in third person.

The report must be written entirely from the Spitfires' perspective — they are the subject of every paragraph. ${resultContext} Focus on how the Spitfires performed: their goals, their goalie, their discipline or penalties, and any standout individual moments. The opponent (${opponentName}) should be mentioned only as context. Do not include a headline. Do not use markdown or bullet points — plain text only.

Match: ${homeTeamName} ${homeScore}–${awayScore} ${awayTeamName}

Goals:
${goalLines}

Penalties:
${penLines}

Netminders:
${goalieLines}`
}
