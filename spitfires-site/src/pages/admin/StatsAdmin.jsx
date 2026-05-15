import { useState, useEffect, useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAMS = [
  { slug: 'a-team', label: 'A Team' },
  { slug: 'b-team', label: 'B Team' },
  { slug: 'c-team', label: 'C Team' },
  { slug: 'd-team', label: 'D Team' },
  { slug: 'womens', label: "Women's" },
]
const TEAM_MAP = Object.fromEntries(TEAMS.map(t => [t.slug, t]))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAcademicYear(dateStr) {
  const d = new Date(dateStr)
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
}

function currentAcademicYear() {
  return getAcademicYear(new Date().toISOString())
}

function seasonLabel(year) {
  if (year === 'all') return 'All Time'
  return `${year}/${String(year + 1).slice(2)}`
}

function parseToiSecs(timeStr) {
  if (!timeStr) return 0
  const p = String(timeStr).split(':').map(Number)
  if (p.length === 3) return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0)
  if (p.length === 2) return (p[0] || 0) * 60 + (p[1] || 0)
  return 0
}

// ─── Stat computation ─────────────────────────────────────────────────────────

function computePlayerStats(games) {
  const skaterMap = {}
  const goalieMap = {}

  for (const game of games) {
    const mr = game.match_reports?.[0]
    if (!mr?.dgs_data) continue

    const dgs        = mr.dgs_data
    const side       = game.home_away
    const spitRoster = side === 'home' ? (dgs.homeRoster || []) : (dgs.awayRoster || [])
    const spitGoalie = side === 'home' ? dgs.homeGoalie : dgs.awayGoalie
    const spitScore  = side === 'home' ? mr.home_score : mr.away_score
    const oppScore   = side === 'home' ? mr.away_score : mr.home_score
    const spitGoals  = (dgs.goals || []).filter(g => g.team === side)

    for (const p of spitRoster) {
      if (!p.dressed) continue
      if (!skaterMap[p.id]) {
        skaterMap[p.id] = { id: p.id, name: p.name, gp: 0, g: 0, a: 0, ppg: 0, shg: 0, eng: 0, pim: 0 }
      }
      const s   = skaterMap[p.id]
      s.name     = p.name
      s.gp      += 1
      s.g       += p.goals
      s.a       += p.assists
      s.pim     += p.pim
      const pg   = spitGoals.filter(gl => gl.scorer?.id === p.id)
      s.ppg     += pg.filter(gl => gl.type === 'PP').length
      s.shg     += pg.filter(gl => gl.type === 'SH').length
      s.eng     += pg.filter(gl => gl.type === 'EN').length
    }

    if (spitGoalie?.player?.id) {
      const id = spitGoalie.player.id
      if (!goalieMap[id]) {
        goalieMap[id] = { id, name: spitGoalie.player.name, gp: 0, w: 0, l: 0, d: 0, ga: 0, sa: 0, sv: 0, so: 0, toiSecs: 0 }
      }
      const g    = goalieMap[id]
      g.name      = spitGoalie.player.name
      g.gp       += 1
      g.ga       += spitGoalie.totalGoals
      g.sa       += spitGoalie.totalShots
      g.sv       += spitGoalie.saves
      g.so       += spitGoalie.totalGoals === 0 ? 1 : 0
      g.toiSecs  += parseToiSecs(spitGoalie.timeOnIce)
      if      (spitScore > oppScore) g.w++
      else if (spitScore < oppScore) g.l++
      else                            g.d++
    }
  }

  const skaters = Object.values(skaterMap).map(s => ({ ...s, pts: s.g + s.a }))

  const goalies = Object.values(goalieMap).map(g => {
    const svPct = g.sa > 0 ? g.sv / g.sa * 100 : 100
    const gaa   = g.toiSecs > 0 ? g.ga / g.toiSecs * 3600 : 0
    return { ...g, svPct, svPctStr: svPct.toFixed(1), gaa, gaaStr: gaa.toFixed(2) }
  })

  return { skaters, goalies }
}

function computeTeamStats(games) {
  const teamMap = {}

  for (const game of games) {
    const mr = game.match_reports?.[0]
    if (!mr) continue

    const slug = game.team
    if (!teamMap[slug]) {
      teamMap[slug] = {
        slug,
        label: TEAM_MAP[slug]?.label ?? slug,
        gp: 0, w: 0, l: 0, d: 0,
        gf: 0, ga: 0,
        ppg: 0, ppOpp: 0,
        pkga: 0, pkOpp: 0,
        shg: 0,
        sf: 0, sfGames: 0,
        sa: 0,
        pim: 0, pimGames: 0,
        rosterSizes: [],
      }
    }
    const ts       = teamMap[slug]
    const side     = game.home_away
    const spitScore = side === 'home' ? (mr.home_score ?? 0) : (mr.away_score ?? 0)
    const oppScore  = side === 'home' ? (mr.away_score ?? 0) : (mr.home_score ?? 0)

    ts.gp++
    ts.gf += spitScore
    ts.ga += oppScore
    if      (spitScore > oppScore) ts.w++
    else if (spitScore < oppScore) ts.l++
    else                            ts.d++

    if (mr.dgs_data) {
      const dgs      = mr.dgs_data
      const spitRoster = side === 'home' ? (dgs.homeRoster || []) : (dgs.awayRoster || [])
      const spitGoalie = side === 'home' ? dgs.homeGoalie : dgs.awayGoalie
      const oppGoalie  = side === 'home' ? dgs.awayGoalie : dgs.homeGoalie
      const spitGoals  = (dgs.goals     || []).filter(g => g.team === side)
      const oppGoals   = (dgs.goals     || []).filter(g => g.team !== side)
      const spitPens   = (dgs.penalties || []).filter(p => p.team === side)
      const oppPens    = (dgs.penalties || []).filter(p => p.team !== side)

      ts.ppg   += spitGoals.filter(g => g.type === 'PP').length
      ts.ppOpp += oppPens.length
      ts.pkga  += oppGoals.filter(g => g.type === 'PP').length
      ts.pkOpp += spitPens.length
      ts.shg   += spitGoals.filter(g => g.type === 'SH').length
      ts.sf    += oppGoalie?.totalShots ?? 0
      ts.sa    += spitGoalie?.totalShots ?? 0
      ts.sfGames++
      ts.pim   += spitPens.reduce((acc, p) => acc + (p.minutes || 0), 0)
      ts.pimGames++

      const dressed = spitRoster.filter(p => p.dressed).length
      if (dressed > 0) ts.rosterSizes.push(dressed)
    }
  }

  return Object.values(teamMap).map(ts => {
    const winPct    = ts.gp     > 0 ? ts.w / ts.gp : 0
    const ppPct     = ts.ppOpp  > 0 ? ts.ppg / ts.ppOpp * 100 : null
    const pkPct     = ts.pkOpp  > 0 ? (1 - ts.pkga / ts.pkOpp) * 100 : null
    const sfPerGame = ts.sfGames > 0 ? ts.sf / ts.sfGames : null
    const pimPerGame = ts.pimGames > 0 ? ts.pim / ts.pimGames : null
    const avgRoster  = ts.rosterSizes.length > 0
      ? ts.rosterSizes.reduce((a, b) => a + b, 0) / ts.rosterSizes.length
      : null
    return {
      ...ts,
      pts: ts.w * 2 + ts.d,
      gd: ts.gf - ts.ga,
      winPct,
      ppPct,
      pkPct,
      sfPerGame,
      pimPerGame,
      avgRoster,
    }
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StatsAdmin() {
  const [allGames,    setAllGames]    = useState(null)
  const [view,        setView]        = useState('player')
  const [teamFilter,  setTeamFilter]  = useState('all')
  const [season,      setSeason]      = useState(currentAcademicYear)
  const [playerTab,   setPlayerTab]   = useState('skaters')

  useEffect(() => {
    supabase
      .from('events')
      .select('id, team, opponent, home_away, starts_at, match_reports!inner(id, home_score, away_score, dgs_data)')
      .eq('type', 'game')
      .then(({ data }) => setAllGames(data || []))
  }, [])

  const seasons = useMemo(() => {
    if (!allGames) return []
    const years = new Set(allGames.map(g => getAcademicYear(g.starts_at)))
    years.add(currentAcademicYear())
    return [...years].sort((a, b) => b - a)
  }, [allGames])

  const filteredGames = useMemo(() => {
    if (!allGames) return []
    if (season === 'all') return allGames
    const start = new Date(`${season}-08-01`)
    const end   = new Date(`${season + 1}-07-31T23:59:59`)
    return allGames.filter(g => {
      const d = new Date(g.starts_at)
      return d >= start && d <= end
    })
  }, [allGames, season])

  const playerGames = useMemo(() => {
    if (teamFilter === 'all') return filteredGames
    return filteredGames.filter(g => g.team === teamFilter)
  }, [filteredGames, teamFilter])

  if (allGames === null) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-white text-2xl font-black uppercase tracking-widest mb-6">Stats</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        <Dropdown
          value={view}
          onChange={v => setView(v)}
          options={[
            { value: 'player', label: 'Player Stats' },
            { value: 'team',   label: 'Team Stats'   },
          ]}
        />
        <Dropdown
          value={String(season)}
          onChange={v => setSeason(v === 'all' ? 'all' : parseInt(v))}
          options={[
            ...seasons.map(y => ({ value: String(y), label: seasonLabel(y) })),
            { value: 'all', label: 'All Time' },
          ]}
        />
        {view === 'player' && (
          <Dropdown
            value={teamFilter}
            onChange={setTeamFilter}
            options={[
              { value: 'all', label: 'All Teams' },
              ...TEAMS.map(t => ({ value: t.slug, label: t.label })),
            ]}
          />
        )}
      </div>

      {view === 'player'
        ? <PlayerStatsView games={playerGames} tab={playerTab} setTab={setPlayerTab} />
        : <TeamStatsView   games={filteredGames} />
      }
    </div>
  )
}

// ─── Player stats view ────────────────────────────────────────────────────────

const SKATER_COLS = [
  { key: '#',   label: '#',   render: (_, i) => i + 1 },
  { key: 'name', label: 'Player', left: true },
  { key: 'gp',  label: 'GP',  title: 'Games Played' },
  { key: 'g',   label: 'G',   title: 'Goals' },
  { key: 'a',   label: 'A',   title: 'Assists' },
  { key: 'pts', label: 'Pts', title: 'Points' },
  { key: 'ppg', label: 'PPG', title: 'Power Play Goals' },
  { key: 'shg', label: 'SHG', title: 'Short Handed Goals' },
  { key: 'eng', label: 'ENG', title: 'Empty Net Goals' },
  { key: 'pim', label: 'PIM', title: 'Penalty Minutes' },
]

const GOALIE_COLS = [
  { key: '#',      label: '#',    render: (_, i) => i + 1 },
  { key: 'name',   label: 'Player', left: true },
  { key: 'gp',    label: 'GP',   title: 'Games Played' },
  { key: 'w',     label: 'W',    title: 'Wins' },
  { key: 'l',     label: 'L',    title: 'Losses' },
  { key: 'd',     label: 'D',    title: 'Draws' },
  { key: 'sa',    label: 'SA',   title: 'Shots Against' },
  { key: 'ga',    label: 'GA',   title: 'Goals Against' },
  { key: 'sv',    label: 'SV',   title: 'Saves' },
  { key: 'svPct', label: 'SV%',  title: 'Save Percentage',       render: row => row.svPctStr },
  { key: 'gaa',   label: 'GAA',  title: 'Goals Against Average', render: row => row.gaaStr   },
  { key: 'so',    label: 'SO',   title: 'Shutouts' },
]

function PlayerStatsView({ games, tab, setTab }) {
  const { skaters, goalies } = useMemo(() => computePlayerStats(games), [games])

  return (
    <div>
      <div className="flex gap-1 mb-5">
        {[['skaters', 'Skaters'], ['goalies', 'Goalies']].map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => setTab(val)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
              tab === val
                ? 'bg-[#00436b] text-white'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-xl overflow-hidden">
        {tab === 'skaters'
          ? <SortTable cols={SKATER_COLS} rows={skaters} defaultSortKey="pts" rowKey="id" />
          : <SortTable cols={GOALIE_COLS} rows={goalies} defaultSortKey="svPct" rowKey="id" />
        }
      </div>
    </div>
  )
}

// ─── Team stats view ──────────────────────────────────────────────────────────

const TEAM_COLS = [
  { key: 'label',      label: 'Team',        left: true },
  { key: 'gp',        label: 'GP',          title: 'Games Played' },
  { key: 'w',         label: 'W',           title: 'Wins' },
  { key: 'l',         label: 'L',           title: 'Losses' },
  { key: 'd',         label: 'D',           title: 'Draws' },
  { key: 'pts',       label: 'Pts',         title: 'Points (2 per win, 1 per draw)' },
  { key: 'gf',        label: 'GF',          title: 'Goals For' },
  { key: 'ga',        label: 'GA',          title: 'Goals Against' },
  { key: 'gd',        label: 'GD',          title: 'Goal Differential',
    render: row => row.gd > 0 ? `+${row.gd}` : String(row.gd) },
  { key: 'winPct',    label: 'Win%',        title: 'Win Percentage',
    render: row => (row.winPct * 100).toFixed(1) },
  { key: 'sfPerGame', label: 'SF/GP',       title: 'Shots For per Game (games with DGS only)',
    render: row => row.sfPerGame != null ? row.sfPerGame.toFixed(1) : '-' },
  { key: 'ppg',       label: 'PPG',         title: 'Power Play Goals' },
  { key: 'ppPct',     label: 'PP%',         title: 'Power Play Percentage',
    render: row => row.ppPct != null ? row.ppPct.toFixed(1) : '-' },
  { key: 'pkPct',     label: 'PK%',         title: 'Penalty Kill Percentage',
    render: row => row.pkPct != null ? row.pkPct.toFixed(1) : '-' },
  { key: 'shg',       label: 'SHG',         title: 'Short Handed Goals' },
  { key: 'pimPerGame', label: 'PIM/GP',     title: 'Penalty Minutes per Game',
    render: row => row.pimPerGame != null ? row.pimPerGame.toFixed(1) : '-' },
  { key: 'avgRoster', label: 'Avg Roster',  title: 'Average Dressed Roster Size',
    render: row => row.avgRoster != null ? row.avgRoster.toFixed(1) : '-' },
]

function TeamStatsView({ games }) {
  const teams = useMemo(() => computeTeamStats(games), [games])

  return (
    <div className="bg-[#111827] border border-white/10 rounded-xl overflow-hidden">
      <SortTable cols={TEAM_COLS} rows={teams} defaultSortKey="pts" rowKey="slug" />
    </div>
  )
}

// ─── Sortable table ───────────────────────────────────────────────────────────

function SortTable({ cols, rows, defaultSortKey, rowKey }) {
  const [sortKey, setSortKey] = useState(defaultSortKey)
  const [sortDir, setSortDir] = useState('desc')

  function handleSort(key) {
    if (key === '#') return
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av = a[sortKey]
      let bv = b[sortKey]
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string') {
        const cmp = av.toLowerCase().localeCompare(bv.toLowerCase())
        return sortDir === 'desc' ? -cmp : cmp
      }
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [rows, sortKey, sortDir])

  if (rows.length === 0) {
    return (
      <p className="text-white/20 text-xs uppercase tracking-widest py-10 text-center">
        No data available.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-white/10">
            {cols.map(col => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                title={col.title}
                className={[
                  'py-3 px-3 text-xs font-black uppercase tracking-widest whitespace-nowrap select-none transition-colors',
                  col.key === '#' ? 'cursor-default' : 'cursor-pointer hover:text-white/60',
                  sortKey === col.key ? 'text-white' : 'text-white/30',
                  col.left ? 'text-left' : 'text-right',
                ].join(' ')}
              >
                <span className={`inline-flex items-center gap-0.5 ${col.left ? '' : 'justify-end w-full'}`}>
                  {col.label}
                  {sortKey === col.key && col.key !== '#' && (
                    sortDir === 'desc'
                      ? <ChevronDown size={9} className="shrink-0" />
                      : <ChevronUp   size={9} className="shrink-0" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row[rowKey] ?? i}
              className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
            >
              {cols.map(col => (
                <td
                  key={col.key}
                  className={[
                    'py-2.5 px-3 text-xs tabular-nums whitespace-nowrap',
                    col.left   ? 'text-left font-medium text-white' : 'text-right text-white',
                    col.key === '#' ? '!text-white/30 !font-normal' : '',
                  ].join(' ')}
                >
                  {col.render ? col.render(row, i) : (row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function Dropdown({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-[#0d1520] border border-white/10 rounded-lg pl-3 pr-8 py-2 text-white text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-[#00436b] transition-colors cursor-pointer appearance-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value} className="bg-[#0d1520]">{o.label}</option>
      ))}
    </select>
  )
}
