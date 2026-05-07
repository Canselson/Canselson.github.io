import { createClient } from '@supabase/supabase-js'

const TEAMS = {
  'a-team': 'A Team',
  'b-team': 'B Team',
  'c-team': 'C Team',
  'd-team': 'D Team',
  'womens': "Women's",
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured' })
  }

  const {
    eventId,
    homeTeamName, awayTeamName, homeScore, awayScore,
    goals, penalties, homeGoalie, awayGoalie,
    homeRoster, awayRoster,
  } = req.body

  if (!homeTeamName || homeScore == null || awayScore == null) {
    return res.status(400).json({ error: 'Invalid game data' })
  }

  let seasonContext = null
  if (eventId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
      seasonContext = await buildSeasonContext(supabase, eventId, {
        homeTeamName, awayTeamName, homeRoster, awayRoster,
      })
    } catch (_) {
      // Non-fatal: generate without season context
    }
  }

  const prompt = buildPrompt({
    homeTeamName, awayTeamName, homeScore, awayScore,
    goals, penalties, homeGoalie, awayGoalie,
    seasonContext,
  })

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
        max_tokens:  900,
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

// ─── Season context builder ───────────────────────────────────────────────────

async function buildSeasonContext(supabase, eventId, { homeTeamName, awayTeamName, homeRoster, awayRoster }) {
  const { data: event } = await supabase
    .from('events')
    .select('id, team, starts_at, opponent')
    .eq('id', eventId)
    .single()

  if (!event?.team) return null

  // Academic year: Aug 1 of one year → Jul 31 of next
  const gameDate   = new Date(event.starts_at)
  const month      = gameDate.getMonth() // 0-indexed; Aug = 7
  const year       = gameDate.getFullYear()
  const seasonYear = month >= 7 ? year : year - 1
  const seasonStart = new Date(seasonYear,     7, 1).toISOString()
  const seasonEnd   = new Date(seasonYear + 1, 7, 1).toISOString()

  // All games for this team in this season that have reports, excluding this game
  const { data: pastEvents } = await supabase
    .from('events')
    .select('id, starts_at, opponent, home_away, match_reports(dgs_data)')
    .eq('team', event.team)
    .eq('type', 'game')
    .gte('starts_at', seasonStart)
    .lt('starts_at',  seasonEnd)
    .neq('id', eventId)
    .order('starts_at', { ascending: true })

  // Next fixture for this team after this game's date
  const { data: nextFixture } = await supabase
    .from('events')
    .select('starts_at, opponent, home_away, location')
    .eq('team', event.team)
    .eq('type', 'game')
    .gt('starts_at', event.starts_at)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Only games that have dgs_data
  const completedGames = (pastEvents || []).filter(ev => ev.match_reports?.[0]?.dgs_data)

  let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0
  const formArr   = []
  const playerStats = {} // name → { goals, assists, pim, gamesPlayed }

  for (const game of completedGames) {
    const dgs = game.match_reports[0].dgs_data

    const spitHome  = /spitfire/i.test(dgs.homeTeamName)
    const spitScore = spitHome ? dgs.homeScore : dgs.awayScore
    const oppScore  = spitHome ? dgs.awayScore : dgs.homeScore
    const roster    = spitHome ? (dgs.homeRoster ?? []) : (dgs.awayRoster ?? [])

    gf += spitScore ?? 0
    ga += oppScore  ?? 0

    if      (spitScore > oppScore) { wins++;   formArr.push('W') }
    else if (spitScore < oppScore) { losses++; formArr.push('L') }
    else                           { draws++;  formArr.push('D') }

    for (const player of roster) {
      if (!player.name || player.isNetminder) continue
      if (!playerStats[player.name]) {
        playerStats[player.name] = { goals: 0, assists: 0, pim: 0, gamesPlayed: 0 }
      }
      playerStats[player.name].goals       += player.goals   || 0
      playerStats[player.name].assists     += player.assists || 0
      playerStats[player.name].pim         += player.pim     || 0
      playerStats[player.name].gamesPlayed += player.dressed ? 1 : 0
    }
  }

  // Players who featured in today's game
  const spitHomeToday = /spitfire/i.test(homeTeamName)
  const todayRoster   = new Set(
    (spitHomeToday ? (homeRoster ?? []) : (awayRoster ?? []))
      .filter(p => p.dressed && !p.isNetminder)
      .map(p => p.name)
  )

  // Also include players who played today but have no prior season stats
  for (const name of todayRoster) {
    if (!playerStats[name]) {
      playerStats[name] = { goals: 0, assists: 0, pim: 0, gamesPlayed: 0 }
    }
  }

  const allPlayers = Object.entries(playerStats)
    .map(([name, s]) => ({
      name,
      gp:    s.gamesPlayed,
      g:     s.goals,
      a:     s.assists,
      pts:   s.goals + s.assists,
      pim:   s.pim,
      today: todayRoster.has(name),
    }))
    .sort((a, b) => b.pts - a.pts || b.g - a.g)

  // H2H record vs this opponent this season
  let h2hW = 0, h2hD = 0, h2hL = 0
  for (const game of completedGames) {
    if (game.opponent?.toLowerCase() !== event.opponent?.toLowerCase()) continue
    const dgs = game.match_reports[0].dgs_data
    const spitHome  = /spitfire/i.test(dgs.homeTeamName)
    const spitScore = spitHome ? dgs.homeScore : dgs.awayScore
    const oppScore  = spitHome ? dgs.awayScore : dgs.homeScore
    if      (spitScore > oppScore) h2hW++
    else if (spitScore < oppScore) h2hL++
    else                           h2hD++
  }

  return {
    teamLabel:   TEAMS[event.team] ?? event.team,
    seasonLabel: `${seasonYear}/${String(seasonYear + 1).slice(2)}`,
    record:      { wins, draws, losses, gf, ga, gp: completedGames.length },
    form:        formArr.slice(-5).join(' '),
    allPlayers,
    nextFixture,
    h2h:         (h2hW + h2hD + h2hL) > 0 ? { wins: h2hW, draws: h2hD, losses: h2hL } : null,
    opponent:    event.opponent,
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt({ homeTeamName, awayTeamName, homeScore, awayScore, goals = [], penalties = [], homeGoalie, awayGoalie, seasonContext }) {
  const spitfiresHome  = /spitfire/i.test(homeTeamName)
  const spitfiresName  = spitfiresHome ? homeTeamName : awayTeamName
  const opponentName   = spitfiresHome ? awayTeamName : homeTeamName
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

  let seasonSection = ''
  if (seasonContext?.record.gp > 0) {
    const { teamLabel, seasonLabel, record, form, allPlayers, nextFixture, h2h, opponent } = seasonContext
    const { wins, draws, losses, gf, ga, gp } = record
    const avgGF = (gf / gp).toFixed(1)
    const avgGA = (ga / gp).toFixed(1)

    const playerRows = allPlayers.map(p => {
      const tick = p.today ? ' ✓' : ''
      return `  ${p.name.padEnd(22)} ${String(p.gp).padStart(2)} GP  ${String(p.g).padStart(2)}G  ${String(p.a).padStart(2)}A  ${String(p.pts).padStart(3)} Pts  ${String(p.pim).padStart(3)} PIM${tick}`
    }).join('\n')

    const nextLine = nextFixture
      ? (() => {
          const d = new Date(nextFixture.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
          const loc = nextFixture.location ? ` at ${nextFixture.location}` : ''
          return `\nNext fixture: ${nextFixture.home_away === 'home' ? 'Home' : 'Away'} vs ${nextFixture.opponent} on ${d}${loc}`
        })()
      : ''

    const h2hLine = h2h
      ? `\nRecord vs ${opponent} this season (before today): W${h2h.wins} D${h2h.draws} L${h2h.losses}`
      : ''

    seasonSection = `

Season context — ${teamLabel} ${seasonLabel} (games before today):
Record: W${wins} D${draws} L${losses} | GF ${gf} GA ${ga} | Avg: ${avgGF} scored, ${avgGA} conceded | Form (last 5): ${form || 'first game of season'}${nextLine}${h2hLine}

Player stats (pre-game season totals; ✓ = played today):
  ${'Name'.padEnd(22)} GP   G   A  Pts  PIM
${playerRows}`
  }

  return `Write a match report for the Southampton Spitfires university ice hockey club website. Write 2–3 paragraphs in third person.

The report must be written entirely from the Spitfires' perspective — they are the subject of every paragraph. ${resultContext} Focus on how the Spitfires performed: their goals, their goalie, their discipline or penalties, and any standout individual moments. The opponent (${opponentName}) should be mentioned only as context. Do not include a headline. Do not use markdown or bullet points — plain text only.

Where season context is provided below, weave in relevant details naturally — a player's goal tally for the season, the team's current form streak, or the upcoming fixture. Only include season details if they genuinely add colour; never force them in.

Match: ${homeTeamName} ${homeScore}–${awayScore} ${awayTeamName}

Goals:
${goalLines}

Penalties:
${penLines}

Netminders:
${goalieLines}${seasonSection}`
}
