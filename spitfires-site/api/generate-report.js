import { createClient } from '@supabase/supabase-js'

const TEAMS = {
  'a-team': 'A Team',
  'b-team': 'B Team',
  'c-team': 'C Team',
  'd-team': 'D Team',
  'womens': "Women's",
}

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!await requireAuth(req, res)) return

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
        homeTeamName, awayTeamName, homeScore, awayScore, homeRoster, awayRoster,
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
  } catch (_) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── Season context builder ───────────────────────────────────────────────────

async function buildSeasonContext(supabase, eventId, { homeTeamName, awayTeamName, homeScore, awayScore, homeRoster, awayRoster }) {
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

  // All games for this team in this season that have reports (excluding this game) + next fixture
  const [{ data: pastEvents }, { data: nextFixture }] = await Promise.all([
    supabase
      .from('events')
      .select('id, starts_at, opponent, home_away, match_reports(dgs_data)')
      .eq('team', event.team)
      .eq('type', 'game')
      .gte('starts_at', seasonStart)
      .lt('starts_at',  seasonEnd)
      .neq('id', eventId)
      .order('starts_at', { ascending: true }),
    supabase
      .from('events')
      .select('starts_at, opponent, home_away, location')
      .eq('team', event.team)
      .eq('type', 'game')
      .gt('starts_at', event.starts_at)
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  // Only past games that have dgs_data
  const completedGames = (pastEvents || []).filter(ev => ev.match_reports?.[0]?.dgs_data)

  let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0
  const formArr     = []
  const playerStats = {} // name → { goals, assists, pim, gamesPlayed }

  // Aggregate all prior completed games
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

  // Merge today's game into stats so the table shows final season totals
  const spitHomeToday    = /spitfire/i.test(homeTeamName)
  const spitScoreToday   = spitHomeToday ? homeScore : awayScore
  const oppScoreToday    = spitHomeToday ? awayScore : homeScore
  const todayRosterArr   = (spitHomeToday ? (homeRoster ?? []) : (awayRoster ?? []))

  gf += spitScoreToday ?? 0
  ga += oppScoreToday  ?? 0
  if      (spitScoreToday > oppScoreToday) { wins++;   formArr.push('W') }
  else if (spitScoreToday < oppScoreToday) { losses++; formArr.push('L') }
  else                                      { draws++;  formArr.push('D') }

  const todayNames = new Set()
  for (const player of todayRosterArr) {
    if (!player.name || player.isNetminder) continue
    if (!playerStats[player.name]) {
      playerStats[player.name] = { goals: 0, assists: 0, pim: 0, gamesPlayed: 0 }
    }
    playerStats[player.name].goals       += player.goals   || 0
    playerStats[player.name].assists     += player.assists || 0
    playerStats[player.name].pim         += player.pim     || 0
    playerStats[player.name].gamesPlayed += player.dressed ? 1 : 0
    if (player.dressed) todayNames.add(player.name)
  }

  const totalGames = completedGames.length + 1

  const allPlayers = Object.entries(playerStats)
    .map(([name, s]) => ({
      name,
      gp:    s.gamesPlayed,
      g:     s.goals,
      a:     s.assists,
      pts:   s.goals + s.assists,
      pim:   s.pim,
      today: todayNames.has(name),
    }))
    .sort((a, b) => b.pts - a.pts || b.g - a.g)

  // H2H record vs this opponent this season (including today)
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
  // Include today's result in H2H
  if (event.opponent) {
    if      (spitScoreToday > oppScoreToday) h2hW++
    else if (spitScoreToday < oppScoreToday) h2hL++
    else                                      h2hD++
  }

  return {
    teamLabel:   TEAMS[event.team] ?? event.team,
    seasonLabel: `${seasonYear}/${String(seasonYear + 1).slice(2)}`,
    record:      { wins, draws, losses, gf, ga, gp: totalGames },
    firstGame:   completedGames.length === 0,
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
  if (seasonContext) {
    const { teamLabel, seasonLabel, record, firstGame, form, allPlayers, nextFixture, h2h, opponent } = seasonContext
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
      : '\nNext fixture: none scheduled'

    const h2hLine = h2h
      ? `\nRecord vs ${opponent} this season: W${h2h.wins} D${h2h.draws} L${h2h.losses}`
      : ''

    const firstGameNote = firstGame
      ? '\nNOTE: This is the first game of the season. Do not mention form, streaks, or prior momentum — there is no prior data.'
      : ''

    seasonSection = `

Season context — ${teamLabel} ${seasonLabel} (totals including today):
Record: W${wins} D${draws} L${losses} | GF ${gf} GA ${ga} | Avg: ${avgGF} scored, ${avgGA} conceded | Form (last 5): ${form}${firstGameNote}${nextLine}${h2hLine}

Player season stats including today (✓ = played today):
  ${'Name'.padEnd(22)} GP   G   A  Pts  PIM
${playerRows}

RULES for using the above data:
- Stats already include today's game. Use the exact numbers shown — never say "a notable figure" or any vague phrase.
- A player with 1G has scored once this season. Say "his first of the season for the ${teamLabel}" or "his 1st goal of the season for the ${teamLabel}".
- Whenever you mention a player's goal or point tally for the season, always specify "for the ${teamLabel}" — players may also play for other teams.
- The next fixture must only be mentioned in the final paragraph. If a next fixture is listed, you MUST name the specific opponent and date when you mention it — never say only "upcoming fixture" or "next match" without naming who they play.
- If next fixture says "none scheduled", do not mention an upcoming game at all.`
  }

  const homeAwayContext = seasonContext
    ? (spitfiresHome ? 'The Spitfires were at home.' : 'The Spitfires were playing away from home.')
    : ''

  return `Write a match report for the Southampton Spitfires university ice hockey club website. Write exactly 3 paragraphs in third person. Do not include a headline. Do not use markdown or bullet points — plain text only. The report must be written entirely from the Spitfires' perspective. The opponent (${opponentName}) should be mentioned only as context.

${homeAwayContext} ${resultContext}

Follow this exact structure:

Paragraph 1 — Opening & performance: State the result and scoreline. Mention the home/away context. Cover the overall flow of the game and any notable period-by-period momentum shifts. Highlight 1–2 standout players with their goals and assists. If season form data is available and not the first game, briefly reference current form.

Paragraph 2 — Stats & discipline: Cover the Spitfires' goalie performance (saves, save percentage). Discuss any penalties — who took them, when, and whether they impacted the game. Mention power play or penalty kill situations if relevant.

Paragraph 3 — Takeaways & next game: Summarise what the result means for the team — positives to build on or lessons to learn. If a next fixture is provided, close by naming the specific opponent and date. Do not mention the next fixture anywhere except this paragraph.

Match: ${homeTeamName} ${homeScore}–${awayScore} ${awayTeamName}

Goals:
${goalLines}

Penalties:
${penLines}

Netminders:
${goalieLines}

Match: ${homeTeamName} ${homeScore}–${awayScore} ${awayTeamName}

Goals:
${goalLines}

Penalties:
${penLines}

Netminders:
${goalieLines}${seasonSection}`
}
