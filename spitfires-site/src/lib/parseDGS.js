export const GOAL_TYPE_LABELS = {
  E:  'Even Strength',
  PP: 'Power Play',
  SH: 'Short Handed',
  PS: 'Penalty Shot',
  EN: 'Empty Net',
}


// ─── Main export ──────────────────────────────────────────────────────────────

export function parseDGS(raw) {
  const sections = splitSections(raw)

  const header = (sections['1']?.[0] ?? '').split(',').map(s => s.trim())
  const homeTeamName = header[0] ?? ''
  const awayTeamName = header[1] ?? ''
  const date         = header[2] ?? ''
  const time         = header[3] ?? ''

  const homeRoster = parseRoster(sections['2'] ?? [])
  const awayRoster = parseRoster(sections['3'] ?? [])

  // Player lookup by BUIHA ID → player object with team tag
  const playerMap = {}
  for (const p of homeRoster) playerMap[p.id] = { ...p, team: 'home' }
  for (const p of awayRoster) playerMap[p.id] = { ...p, team: 'away' }

  // %4 = home goals, %5 = away goals — team is determined by section, not a data field
  const goals = [
    ...parseGoals(sections['4'] ?? [], playerMap, 'home'),
    ...parseGoals(sections['5'] ?? [], playerMap, 'away'),
  ].sort((a, b) => timeToSecs(a.cumulativeTime) - timeToSecs(b.cumulativeTime))

  // %6 = home penalties, %7 = away penalties
  const penalties = [
    ...parsePenalties(sections['6'] ?? [], playerMap, 'home'),
    ...parsePenalties(sections['7'] ?? [], playerMap, 'away'),
  ].sort((a, b) => timeToSecs(a.cumulativeTime) - timeToSecs(b.cumulativeTime))

  const homeGoalie = parseGoalie(sections['8']?.[0], playerMap)
  const awayGoalie = parseGoalie(sections['9']?.[0], playerMap)

  const homeScore = goals.filter(g => g.team === 'home').length
  const awayScore = goals.filter(g => g.team === 'away').length

  return {
    homeTeamName, awayTeamName, date, time,
    homeScore, awayScore,
    homeRoster, awayRoster,
    goals, penalties,
    homeGoalie, awayGoalie,
  }
}

// ─── Section splitter ─────────────────────────────────────────────────────────

function splitSections(raw) {
  const sections = {}
  let current = null
  for (const line of raw.replace(/\r/g, '').split('\n')) {
    const t = line.trim()
    if (!t || t === '{}') continue
    if (t.startsWith('%')) {
      current = t.slice(1)
      sections[current] = []
    } else if (current !== null) {
      sections[current].push(t)
    }
  }
  return sections
}

// ─── Roster (%2 / %3) ─────────────────────────────────────────────────────────
// playerID, name, jerseyNum, goals, assists, PIM, isCaptain, isAssistCaptain,
// isNetminder, ?, dressed(1=yes)

function parseRoster(lines) {
  return lines.map(line => {
    const p = line.split(',').map(s => s.trim())
    return {
      id:                 p[0],
      name:               p[1],
      number:             parseInt(p[2])  || 0,
      goals:              parseInt(p[3])  || 0,
      assists:            parseInt(p[4])  || 0,
      pim:                parseInt(p[5])  || 0,
      isCaptain:          p[6] === '1',
      isAssistantCaptain: p[7] === '1',
      isNetminder:        p[8] === '1',
      dressed:            p[10] === '1',
    }
  })
}

// ─── Goals (%4 = home, %5 = away) ────────────────────────────────────────────
// cumulativeTime, scorerID, assist1ID|null, assist2ID|null, type, _, UUID

function parseGoals(lines, playerMap, team) {
  return lines.map(line => {
    const p    = line.split(',').map(s => s.trim())
    const a1Id = p[2] !== 'null' ? p[2] : null
    const a2Id = p[3] !== 'null' ? p[3] : null
    const type = p[4]
    return {
      cumulativeTime: p[0],
      period:         getPeriod(p[0]),
      periodTime:     getPeriodTime(p[0]),
      scorer:         playerMap[p[1]]  ?? null,
      assist1:        a1Id ? (playerMap[a1Id] ?? null) : null,
      assist2:        a2Id ? (playerMap[a2Id] ?? null) : null,
      type,
      typeLabel:      GOAL_TYPE_LABELS[type] ?? type,
      team,
    }
  })
}

// ─── Penalties (%6 = home, %7 = away) ────────────────────────────────────────
// offenceCode, givenAt, playerID, minutes, penaltyStart, penaltyEnd, UUID

function parsePenalties(lines, playerMap, sectionTeam) {
  return lines.map(line => {
    const p       = line.split(',').map(s => s.trim())
    const isBench = !p[2] || p[2] === 'null'
    const player  = isBench ? { name: 'Bench', id: null, team: sectionTeam } : (playerMap[p[2]] ?? null)
    const code    = p[0]
    return {
      offenceCode:    code,
      offenceLabel:   code,
      cumulativeTime: p[1],
      period:         getPeriod(p[1]),
      periodTime:     getPeriodTime(p[1]),
      player,
      team:           player?.team ?? sectionTeam,
      minutes:        parseInt(p[3]) || 0,
      start:          p[4],
      end:            p[5],
    }
  })
}

// ─── Goalie (%8 = home, %9 = away) ───────────────────────────────────────────
// playerID, TOI, P1shots, P1goalsAgainst, P2shots, P2goalsAgainst, P3shots, P3goalsAgainst

function parseGoalie(line, playerMap) {
  if (!line) return null
  const p       = line.split(',').map(s => s.trim())
  const periods = [
    { shots: parseInt(p[2]) || 0, goals: parseInt(p[3]) || 0 },
    { shots: parseInt(p[4]) || 0, goals: parseInt(p[5]) || 0 },
    { shots: parseInt(p[6]) || 0, goals: parseInt(p[7]) || 0 },
  ]
  const totalShots = periods.reduce((a, x) => a + x.shots, 0)
  const totalGoals = periods.reduce((a, x) => a + x.goals, 0)
  const saves      = totalShots - totalGoals
  return {
    player:       playerMap[p[0]] ?? null,
    timeOnIce:    p[1],
    periods,
    totalShots,
    totalGoals,
    saves,
    savePercent:  totalShots > 0
      ? ((saves / totalShots) * 100).toFixed(1)
      : '100.0',
  }
}

// ─── Time helpers ─────────────────────────────────────────────────────────────
// Times in .dgs are cumulative game clock. Periods are 3×20 min.

function timeToSecs(timeStr) {
  if (!timeStr) return 0
  const [m, s] = timeStr.split(':').map(Number)
  return (m || 0) * 60 + (s || 0)
}

function getPeriod(timeStr) {
  if (!timeStr) return 1
  const mins = parseInt(timeStr.split(':')[0]) || 0
  if (mins < 20) return 1
  if (mins < 40) return 2
  if (mins < 60) return 3
  return 'OT'
}

function getPeriodTime(timeStr) {
  if (!timeStr) return '0:00'
  const [mStr, sStr] = timeStr.split(':')
  const totalSecs    = (parseInt(mStr) || 0) * 60 + (parseInt(sStr) || 0)
  const period       = getPeriod(timeStr)
  const offset       = (typeof period === 'number' ? period - 1 : 3) * 20 * 60
  const elapsed      = totalSecs - offset
  const m            = Math.floor(elapsed / 60)
  const s            = elapsed % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
