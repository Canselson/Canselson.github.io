import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Upload, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { parseDGS } from '../../lib/parseDGS'

const TEAMS = {
  'a-team': 'A Team',
  'b-team': 'B Team',
  'c-team': 'C Team',
  'd-team': 'D Team',
  'womens': "Women's",
}

export default function ReportAdmin() {
  const { eventId } = useParams()
  const navigate    = useNavigate()

  const [event,      setEvent]      = useState(null)
  const [report,     setReport]     = useState(null)
  const [dgsData,    setDgsData]    = useState(null)
  const [reportText, setReportText] = useState('')
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)  // null | 'saved' | 'error'
  const [parseError, setParseError] = useState(null)
  const [tab,        setTab]        = useState('goals')
  const fileRef = useRef()

  useEffect(() => {
    async function load() {
      const [{ data: ev }, { data: rpt }] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('match_reports').select('*').eq('event_id', eventId).maybeSingle(),
      ])
      setEvent(ev)
      if (rpt) {
        setReport(rpt)
        setReportText(rpt.report_text ?? '')
        setDgsData(rpt.dgs_data ?? null)
      }
      setLoading(false)
    }
    load()
  }, [eventId])

  function handleDgsFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        setDgsData(parseDGS(ev.target.result))
      } catch (err) {
        setParseError('Failed to parse .dgs file: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  async function save() {
    setSaving(true)
    setSaveStatus(null)
    const payload = {
      event_id:    eventId,
      report_text: reportText.trim() || null,
      dgs_data:    dgsData,
      home_score:  dgsData?.homeScore ?? null,
      away_score:  dgsData?.awayScore ?? null,
    }
    const { data, error } = report
      ? await supabase.from('match_reports').update(payload).eq('id', report.id).select().single()
      : await supabase.from('match_reports').insert(payload).select().single()

    if (error) {
      setSaveStatus('error')
    } else {
      setReport(data)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 3000)
    }
    setSaving(false)
  }

  if (loading) return <div className="text-white/40 text-sm animate-pulse">Loading…</div>
  if (!event)  return <div className="text-red-400 text-sm">Event not found.</div>

  const dateStr   = new Date(event.starts_at).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => navigate('/admin')}
        className="text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors mb-6 inline-block"
      >
        ← Calendar
      </button>

      <div className="mb-8">
        <p className="text-[#641e31] text-xs font-black uppercase tracking-[0.3em] mb-1">Match Report</p>
        <h1 className="text-white text-3xl font-black uppercase tracking-tight">vs {event.opponent}</h1>
        <p className="text-white/40 text-sm mt-1">
          {TEAMS[event.team] ?? event.team} · {dateStr}
        </p>
      </div>

      <div className="flex flex-col gap-5">

        {/* DGS upload */}
        <div className="bg-[#111827] border border-white/10 rounded-xl p-5">
          <p className="text-white/50 text-xs font-black uppercase tracking-widest mb-4">Gamesheet (.dgs)</p>
          {dgsData ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-white font-bold">
                  {dgsData.homeTeamName}{' '}
                  <span className="text-[#7ec8e3]">{dgsData.homeScore}</span>
                  <span className="text-white/30 mx-2">–</span>
                  <span className="text-[#e89aaa]">{dgsData.awayScore}</span>
                  {' '}{dgsData.awayTeamName}
                </p>
                <p className="text-white/30 text-xs mt-0.5">
                  {dgsData.goals.length} goals · {dgsData.penalties.length} penalties · parsed OK
                </p>
              </div>
              <button
                onClick={() => { setDgsData(null); fileRef.current?.click() }}
                className="text-xs font-bold uppercase tracking-widest text-white/30 hover:text-white transition-colors"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-white/10 rounded-xl py-10 text-white/25 hover:border-white/25 hover:text-white/50 transition-colors flex flex-col items-center gap-2"
            >
              <Upload size={22} />
              <span className="text-xs font-bold uppercase tracking-widest">Upload .dgs file</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept=".dgs" className="hidden" onChange={handleDgsFile} />
          {parseError && <p className="text-red-400 text-xs mt-3">{parseError}</p>}
        </div>

        {/* DGS preview tabs */}
        {dgsData && (
          <div className="bg-[#111827] border border-white/10 rounded-xl overflow-hidden">
            <div className="flex border-b border-white/10 px-4 gap-1 pt-2">
              {[
                { key: 'goals',     label: `Goals (${dgsData.goals.length})` },
                { key: 'penalties', label: `Penalties (${dgsData.penalties.length})` },
                { key: 'goalies',   label: 'Goalies' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                    tab === t.key
                      ? 'text-white border-[#641e31]'
                      : 'text-white/30 border-transparent hover:text-white/60'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-4">
              {tab === 'goals'     && <GoalsPreview     goals={dgsData.goals} />}
              {tab === 'penalties' && <PenaltiesPreview penalties={dgsData.penalties} />}
              {tab === 'goalies'   && (
                <GoaliesPreview
                  homeGoalie={dgsData.homeGoalie}
                  awayGoalie={dgsData.awayGoalie}
                  homeTeam={dgsData.homeTeamName}
                  awayTeam={dgsData.awayTeamName}
                />
              )}
            </div>
          </div>
        )}

        {/* Report narrative */}
        <div className="bg-[#111827] border border-white/10 rounded-xl p-5">
          <p className="text-white/50 text-xs font-black uppercase tracking-widest mb-3">
            Report Narrative (optional)
          </p>
          <textarea
            value={reportText}
            onChange={e => setReportText(e.target.value)}
            rows={8}
            placeholder="Write a match report here…"
            className="w-full bg-[#0a0f1a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/25 resize-y transition-colors"
          />
        </div>

        {/* Save row */}
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={save}
            disabled={saving || (!dgsData && !reportText.trim())}
            className="flex items-center gap-2 bg-[#00436b] hover:bg-[#005a8f] disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
          >
            <Save size={13} />
            {saving ? 'Saving…' : 'Save Report'}
          </button>
          {saveStatus === 'saved' && (
            <span className="text-green-400 text-xs font-bold uppercase tracking-widest">Saved!</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-400 text-xs font-bold uppercase tracking-widest">Save failed — check console</span>
          )}
          {report && (
            <Link
              to={`/report/${eventId}`}
              target="_blank"
              className="text-white/30 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors ml-auto"
            >
              View Public Page →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Preview: Goals ───────────────────────────────────────────────────────────

function GoalsPreview({ goals }) {
  if (goals.length === 0) return <p className="text-white/20 text-sm py-2">No goals recorded.</p>
  return (
    <div className="flex flex-col">
      {goals.map((g, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 text-sm">
          <span className="text-white/30 text-xs font-mono w-9 shrink-0 tabular-nums">{g.periodTime}</span>
          <span className="text-white/25 text-xs w-5 shrink-0">P{g.period}</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-bold shrink-0"
            style={{
              backgroundColor: g.team === 'home' ? 'rgba(0,67,107,0.4)' : 'rgba(100,30,49,0.4)',
              color:           g.team === 'home' ? '#7ec8e3'             : '#e89aaa',
            }}
          >
            {g.team}
          </span>
          <span className="text-white font-semibold flex-1 min-w-0 truncate">{g.scorer?.name ?? '?'}</span>
          <span className="text-white/30 text-xs truncate hidden sm:block">
            {[g.assist1, g.assist2].filter(Boolean).map(a => a.name).join(', ')}
          </span>
          {g.type !== 'E' && <span className="text-white/30 text-xs shrink-0">{g.typeLabel}</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Preview: Penalties ───────────────────────────────────────────────────────

function PenaltiesPreview({ penalties }) {
  if (penalties.length === 0) return <p className="text-white/20 text-sm py-2">No penalties recorded.</p>
  return (
    <div className="flex flex-col">
      {penalties.map((p, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 text-sm">
          <span className="text-white/30 text-xs font-mono w-9 shrink-0 tabular-nums">{p.periodTime}</span>
          <span className="text-white/25 text-xs w-5 shrink-0">P{p.period}</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-bold shrink-0"
            style={{
              backgroundColor: p.team === 'home' ? 'rgba(0,67,107,0.4)' : 'rgba(100,30,49,0.4)',
              color:           p.team === 'home' ? '#7ec8e3'             : '#e89aaa',
            }}
          >
            {p.team ?? '?'}
          </span>
          <span className="text-white font-semibold flex-1 min-w-0 truncate">{p.player?.name ?? '?'}</span>
          <span className="text-white/30 text-xs shrink-0 hidden sm:block">{p.offenceLabel}</span>
          <span className="text-white/50 text-xs font-bold shrink-0">{p.minutes} min</span>
        </div>
      ))}
    </div>
  )
}

// ─── Preview: Goalies ─────────────────────────────────────────────────────────

function GoaliesPreview({ homeGoalie, awayGoalie, homeTeam, awayTeam }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {homeGoalie && <GoaliePreviewCard goalie={homeGoalie} teamName={homeTeam} label="Home" />}
      {awayGoalie && <GoaliePreviewCard goalie={awayGoalie} teamName={awayTeam} label="Away" />}
    </div>
  )
}

function GoaliePreviewCard({ goalie, teamName, label }) {
  return (
    <div className="bg-[#0d1520] rounded-lg p-4">
      <p className="text-white/30 text-xs uppercase tracking-widest mb-1">{label} — {teamName}</p>
      <p className="text-white font-bold mb-3">{goalie.player?.name ?? 'Unknown'}</p>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Saves', value: goalie.saves },
          { label: 'SA',    value: goalie.totalShots },
          { label: 'GA',    value: goalie.totalGoals },
          { label: 'SV%',   value: `${goalie.savePercent}%` },
        ].map(s => (
          <div key={s.label}>
            <p className="text-white font-bold text-base">{s.value}</p>
            <p className="text-white/30 text-xs">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
