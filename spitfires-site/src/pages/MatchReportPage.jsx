import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TEAMS = {
  'a-team': 'A Team',
  'b-team': 'B Team',
  'c-team': 'C Team',
  'd-team': 'D Team',
  'womens': "Women's",
}

export default function MatchReportPage() {
  const { eventId } = useParams()
  const [event,    setEvent]    = useState(null)
  const [report,   setReport]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: ev, error: evErr }, { data: rpt }] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('match_reports').select('*').eq('event_id', eventId).maybeSingle(),
      ])
      if (evErr || !ev) { setNotFound(true); setLoading(false); return }
      setEvent(ev)
      setReport(rpt)
      setLoading(false)
    }
    load()
  }, [eventId])

  if (loading) return (
    <div className="pt-32 flex justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
    </div>
  )

  if (notFound) return (
    <div className="pt-32 text-center">
      <p className="text-white/40 text-sm uppercase tracking-widest mb-4">Game not found.</p>
      <Link to="/fixtures" className="text-[#641e31] text-xs uppercase tracking-widest hover:text-white transition-colors">
        ← Back to Fixtures
      </Link>
    </div>
  )

  const dgs       = report?.dgs_data ?? null
  const homeTeam  = dgs?.homeTeamName ?? 'Southampton Spitfires'
  const awayTeam  = dgs?.awayTeamName ?? event.opponent
  const homeScore = dgs?.homeScore    ?? report?.home_score ?? null
  const awayScore = dgs?.awayScore    ?? report?.away_score ?? null
  const date      = new Date(event.starts_at).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="pt-24 pb-24 max-w-4xl mx-auto px-4">
      <Link
        to="/fixtures"
        className="text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors mb-6 inline-block"
      >
        ← Fixtures
      </Link>

      <ScoreBanner
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeScore={homeScore}
        awayScore={awayScore}
        date={date}
        teamLabel={TEAMS[event.team] ?? null}
        homeAway={event.home_away}
      />

      {!report && (
        <div className="text-center py-16 text-white/20 text-sm uppercase tracking-widest">
          Match report coming soon.
        </div>
      )}

      {report?.report_text && (
        <Section title="Match Report">
          <div className="bg-[#111827] border border-white/10 rounded-xl p-6">
            <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{report.report_text}</p>
          </div>
        </Section>
      )}

      {dgs?.goals?.length > 0 && (
        <Section title="Goals" count={dgs.goals.length}>
          <GoalsSection goals={dgs.goals} />
        </Section>
      )}

      {dgs?.penalties?.length > 0 && (
        <Section title="Penalties" count={dgs.penalties.length}>
          <PenaltiesSection penalties={dgs.penalties} />
        </Section>
      )}

      {(dgs?.homeGoalie || dgs?.awayGoalie) && (
        <Section title="Goaltending">
          <GoaliesSection
            homeGoalie={dgs.homeGoalie}
            awayGoalie={dgs.awayGoalie}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
          />
        </Section>
      )}
    </div>
  )
}

// ─── Score banner ─────────────────────────────────────────────────────────────

function ScoreBanner({ homeTeam, awayTeam, homeScore, awayScore, date, teamLabel, homeAway }) {
  const hasScore = homeScore !== null && awayScore !== null
  return (
    <div className="bg-[#111827] border border-white/10 rounded-2xl overflow-hidden mb-8">
      <div className="h-1 bg-gradient-to-r from-[#00436b] via-white/10 to-[#641e31]" />
      <div className="px-6 py-8 sm:py-10">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white/25 text-xs uppercase tracking-widest mb-1">Home</p>
            <p className="text-white font-black text-lg sm:text-2xl leading-tight">{homeTeam}</p>
          </div>
          <div className="shrink-0 text-center px-2">
            {hasScore ? (
              <p className="text-white font-black text-4xl sm:text-6xl tabular-nums leading-none">
                {homeScore}
                <span className="text-white/20 text-3xl sm:text-5xl mx-1 sm:mx-2">–</span>
                {awayScore}
              </p>
            ) : (
              <p className="text-white/20 font-black text-3xl">vs</p>
            )}
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-white/25 text-xs uppercase tracking-widest mb-1">Away</p>
            <p className="text-white font-black text-lg sm:text-2xl leading-tight">{awayTeam}</p>
          </div>
        </div>
        <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 mt-5 text-white/30 text-xs uppercase tracking-widest">
          {teamLabel && <><span>{teamLabel}</span><span>·</span></>}
          {homeAway  && <><span className="capitalize">{homeAway}</span><span>·</span></>}
          <span>{date}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Goals ────────────────────────────────────────────────────────────────────

function GoalsSection({ goals }) {
  const grouped = [1, 2, 3, 'OT']
    .map(p => ({ period: p, goals: goals.filter(g => g.period === p) }))
    .filter(g => g.goals.length > 0)

  return (
    <div className="flex flex-col gap-5">
      {grouped.map(({ period, goals: pg }) => (
        <div key={period}>
          <p className="text-white/25 text-xs font-black uppercase tracking-widest mb-2 pl-1">
            {period === 'OT' ? 'Overtime' : `Period ${period}`}
          </p>
          <div className="flex flex-col gap-1.5">
            {pg.map((goal, i) => <GoalRow key={i} goal={goal} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function GoalRow({ goal }) {
  const assists = [goal.assist1, goal.assist2].filter(Boolean)
  const isHome  = goal.team === 'home'
  return (
    <div className="flex items-center gap-3 bg-[#0d1520] border border-white/10 rounded-xl px-4 py-3">
      <span className="text-white/35 text-xs font-mono w-9 shrink-0 tabular-nums">{goal.periodTime}</span>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isHome ? '#00436b' : '#641e31' }} />
      <div className="flex-1 min-w-0">
        <span className="text-white font-bold text-sm">{goal.scorer?.name ?? 'Unknown'}</span>
        {assists.length > 0 && (
          <span className="text-white/40 text-xs ml-2">
            ({assists.map(a => a.name).join(', ')})
          </span>
        )}
      </div>
      {goal.type !== 'E' && (
        <span className="text-white/40 text-xs font-bold px-2 py-0.5 rounded bg-white/5 shrink-0">
          {goal.typeLabel}
        </span>
      )}
    </div>
  )
}

// ─── Penalties ────────────────────────────────────────────────────────────────

function PenaltiesSection({ penalties }) {
  const grouped = [1, 2, 3, 'OT']
    .map(p => ({ period: p, penalties: penalties.filter(pen => pen.period === p) }))
    .filter(g => g.penalties.length > 0)

  return (
    <div className="flex flex-col gap-5">
      {grouped.map(({ period, penalties: pp }) => (
        <div key={period}>
          <p className="text-white/25 text-xs font-black uppercase tracking-widest mb-2 pl-1">
            {period === 'OT' ? 'Overtime' : `Period ${period}`}
          </p>
          <div className="flex flex-col gap-1.5">
            {pp.map((pen, i) => <PenaltyRow key={i} penalty={pen} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function PenaltyRow({ penalty }) {
  const isHome = penalty.team === 'home'
  return (
    <div className="flex items-center gap-3 bg-[#0d1520] border border-white/10 rounded-xl px-4 py-3">
      <span className="text-white/35 text-xs font-mono w-9 shrink-0 tabular-nums">{penalty.periodTime}</span>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isHome ? '#00436b' : '#641e31' }} />
      <div className="flex-1 min-w-0">
        <span className="text-white font-bold text-sm">{penalty.player?.name ?? 'Unknown'}</span>
        <span className="text-white/40 text-xs ml-2">{penalty.offenceLabel}</span>
      </div>
      <span className="text-white/40 text-xs font-bold shrink-0">{penalty.minutes} min</span>
    </div>
  )
}

// ─── Goalies ──────────────────────────────────────────────────────────────────

function GoaliesSection({ homeGoalie, awayGoalie, homeTeam, awayTeam }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {homeGoalie && <GoalieCard goalie={homeGoalie} teamName={homeTeam} label="Home" color="#00436b" />}
      {awayGoalie && <GoalieCard goalie={awayGoalie} teamName={awayTeam} label="Away" color="#641e31" />}
    </div>
  )
}

function GoalieCard({ goalie, teamName, label, color }) {
  return (
    <div className="bg-[#0d1520] border border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-white/30 text-xs uppercase tracking-widest">{label} · {teamName}</p>
      </div>
      <p className="text-white font-black text-lg mb-4">
        {goalie.player?.name ?? 'Unknown'}
        {goalie.player?.number ? (
          <span className="text-white/30 text-sm font-normal ml-2">#{goalie.player.number}</span>
        ) : null}
      </p>
      <div className="grid grid-cols-4 gap-3 text-center">
        {[
          { label: 'Saves', value: goalie.saves },
          { label: 'SA',    value: goalie.totalShots },
          { label: 'GA',    value: goalie.totalGoals },
          { label: 'SV%',   value: `${goalie.savePercent}%` },
        ].map(s => (
          <div key={s.label}>
            <p className="text-white font-black text-xl">{s.value}</p>
            <p className="text-white/30 text-xs uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center border-t border-white/5 pt-3">
        {goalie.periods.map((p, i) => (
          <div key={i} className="text-white/30 text-xs">
            <p className="font-bold text-white/50 mb-0.5">P{i + 1}</p>
            <p>{p.shots - p.goals}/{p.shots}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, count, children }) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-4 bg-[#641e31] rounded-full shrink-0" />
        <h2 className="text-white text-sm font-black uppercase tracking-widest">{title}</h2>
        {count != null && <span className="text-white/25 text-xs font-bold">{count}</span>}
        <div className="h-px flex-1 bg-white/10" />
      </div>
      {children}
    </div>
  )
}
