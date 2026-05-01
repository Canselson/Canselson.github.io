import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TEAMS = [
  { slug: 'a-team',  name: 'A Team'  },
  { slug: 'b-team',  name: 'B Team'  },
  { slug: 'c-team',  name: 'C Team'  },
  { slug: 'd-team',  name: 'D Team'  },
  { slug: 'womens',  name: "Women's" },
]

export default function FixturesPage() {
  const [games,      setGames]      = useState([])
  const [reportMap,  setReportMap]  = useState({})   // eventId → {id, home_score, away_score}
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [activeTeam, setActiveTeam] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: games, error: gErr }, { data: reports }] = await Promise.all([
        supabase.from('events').select('*').eq('type', 'game').order('starts_at', { ascending: true }),
        supabase.from('match_reports').select('event_id, id, home_score, away_score'),
      ])
      if (gErr) { setError(gErr.message); setLoading(false); return }
      setGames(games || [])
      const map = {}
      for (const r of (reports || [])) map[r.event_id] = r
      setReportMap(map)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = activeTeam
    ? games.filter(g => g.team === activeTeam)
    : games

  const now      = new Date()
  const upcoming = filtered.filter(g => new Date(g.starts_at) >= now)
  const recent   = filtered.filter(g => new Date(g.starts_at) <  now).reverse()

  return (
    <div className="pt-24 pb-24 max-w-4xl mx-auto px-4">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[#641e31] text-xs font-black uppercase tracking-[0.3em] mb-2">
          Southampton Spitfires
        </p>
        <h1 className="text-white text-4xl sm:text-5xl font-black uppercase tracking-tight">
          Fixtures
        </h1>
        <p className="text-white/40 mt-3 text-sm">
          Upcoming games and recent results across all teams.
        </p>
      </div>

      {/* Team filter */}
      <div className="flex flex-wrap gap-2 mb-10">
        <TeamPill label="All Teams" active={activeTeam === null} onClick={() => setActiveTeam(null)} />
        {TEAMS.map(t => (
          <TeamPill
            key={t.slug}
            label={t.name}
            active={activeTeam === t.slug}
            onClick={() => setActiveTeam(prev => prev === t.slug ? null : t.slug)}
          />
        ))}
      </div>

      {loading && <LoadingState />}
      {error   && <ErrorState message={error} />}

      {!loading && !error && (
        <>
          <FixtureSection title="Upcoming" games={upcoming} reportMap={reportMap} emptyText="No upcoming fixtures." />
          <FixtureSection title="Recent Results" games={recent} reportMap={reportMap} emptyText="No recent results." past />
        </>
      )}
    </div>
  )
}

// ─── Team filter pill ─────────────────────────────────────────────────────────

function TeamPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
        active
          ? 'bg-white/20 text-white'
          : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function FixtureSection({ title, games, reportMap, emptyText, past = false }) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: past ? '#374151' : '#641e31' }} />
        <h2 className="text-white text-sm font-black uppercase tracking-widest">{title}</h2>
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-white/25 text-xs font-bold">{games.length}</span>
      </div>

      {games.length === 0 ? (
        <p className="text-white/20 text-sm py-2 pl-4">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {games.map(g => <FixtureRow key={g.id} game={g} past={past} report={reportMap[g.id] ?? null} />)}
        </div>
      )}
    </div>
  )
}

// ─── Fixture row ──────────────────────────────────────────────────────────────

function FixtureRow({ game, past, report }) {
  const date     = new Date(game.starts_at)
  const isHome   = game.home_away === 'home'
  const teamInfo = TEAMS.find(t => t.slug === game.team)
  const hasReport = past && report

  const inner = (
    <div className={`flex items-center gap-0 bg-[#111827] border rounded-xl overflow-hidden transition-colors ${
      past
        ? hasReport ? 'border-white/10 opacity-80 hover:opacity-100 hover:border-white/20' : 'border-white/5 opacity-60'
        : 'border-white/10 hover:border-white/20'
    }`}>
      {/* Left accent stripe */}
      <div
        className="w-1 self-stretch shrink-0"
        style={{ backgroundColor: isHome ? '#00436b' : '#641e31' }}
      />

      {/* Date block */}
      <div className="px-4 py-4 text-center w-20 shrink-0 border-r border-white/10">
        <p className="text-white/40 text-xs font-bold uppercase tracking-wider">
          {date.toLocaleDateString('en-GB', { month: 'short' })}
        </p>
        <p className="text-white text-2xl font-black leading-none">
          {date.getDate()}
        </p>
        <p className="text-white/30 text-xs uppercase tracking-wider">
          {date.toLocaleDateString('en-GB', { weekday: 'short' })}
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 px-5 py-4 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {teamInfo && (
            <span className="text-white/50 text-xs font-bold uppercase tracking-widest">
              {teamInfo.name}
            </span>
          )}
          {teamInfo && <span className="text-white/20 text-xs">·</span>}
          <span
            className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{
              backgroundColor: isHome ? 'rgba(0,67,107,0.4)' : 'rgba(100,30,49,0.4)',
              color:           isHome ? '#7ec8e3'             : '#e89aaa',
            }}
          >
            {isHome ? 'Home' : 'Away'}
          </span>
        </div>
        <p className="text-white font-bold text-lg leading-tight mt-1">
          vs {game.opponent}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-white/35 text-xs">
          <span>
            {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {game.location && (
            <span className="flex items-center gap-1">
              <MapPin size={10} />{game.location}
            </span>
          )}
        </div>
      </div>

      {/* Result / time */}
      <div className="px-5 py-4 shrink-0 text-right hidden sm:block">
        {past ? (
          hasReport ? (
            <div>
              <p className="text-white font-black text-xl tabular-nums leading-none">
                {report.home_score}
                <span className="text-white/30 mx-1 font-normal">–</span>
                {report.away_score}
              </p>
              <p className="text-[#7ec8e3] text-xs font-bold uppercase tracking-widest mt-1">
                Report →
              </p>
            </div>
          ) : (
            <span className="text-white/20 text-xs font-bold uppercase tracking-widest">
              Result TBD
            </span>
          )
        ) : (
          <span className="text-white/15 text-xs uppercase tracking-widest">
            {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )

  return hasReport
    ? <Link to={`/report/${game.id}`}>{inner}</Link>
    : inner
}

// ─── States ───────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-24 bg-[#111827] border border-white/10 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

function ErrorState({ message }) {
  return (
    <div className="bg-[#7f1d1d]/20 border border-[#7f1d1d]/40 rounded-xl p-6 text-center">
      <p className="text-red-400 text-sm font-semibold">Failed to load fixtures</p>
      <p className="text-red-400/60 text-xs mt-1">{message}</p>
    </div>
  )
}
