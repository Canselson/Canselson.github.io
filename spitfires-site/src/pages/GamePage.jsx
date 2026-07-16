import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import PageMeta from '../components/PageMeta'
import { supabase } from '../lib/supabase'
import { flagUrl } from '../data/countryFlags'
import { getDeviceId, getDisplayName, saveDisplayName } from '../lib/gameIdentity'

const STAT_FIELDS = [
  { key: 'games_played',  label: 'Games' },
  { key: 'goals',         label: 'Goals' },
  { key: 'assists',       label: 'Assists' },
  { key: 'pims',          label: 'PIMs' },
  { key: 'years_in_club', label: 'Years' },
]

const MAX_BLUR_PX = 20

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoDateOffset(iso, deltaDays) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

function dayNumber() {
  const d = new Date()
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)
}

// Deterministic PRNG so the same seed always produces the same shuffle.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle(length, seed) {
  const order = Array.from({ length }, (_, i) => i)
  const rand = mulberry32(seed)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

// Cycles through every player once (in a shuffled, seeded-per-cycle order)
// before any player repeats as the daily answer.
function dailyPlayerIndex(length) {
  const day = dayNumber()
  const cycle = Math.floor(day / length)
  const position = day % length
  return seededShuffle(length, cycle)[position]
}

function compareNumber(guessValue, answerValue) {
  if (guessValue === answerValue) return 'match'
  return guessValue < answerValue ? 'higher' : 'lower'
}

export default function GamePage() {
  const [players, setPlayers] = useState(null)

  useEffect(() => {
    supabase
      .from('game_players')
      .select('*')
      .order('name')
      .then(({ data }) => setPlayers(data || []))
  }, [])

  const dayKey = todayKey()
  const answer = useMemo(() => {
    if (!players || players.length === 0) return null
    return players[dailyPlayerIndex(players.length)]
  }, [players, dayKey])

  const storageKey = `spitfires-guesser-${dayKey}`

  const [guesses, setGuesses] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]')
      return Array.isArray(saved) ? saved : []
    } catch {
      return []
    }
  })
  const [query, setQuery] = useState('')
  const [showOptions, setShowOptions] = useState(false)

  const [displayName, setDisplayNameState] = useState(() => getDisplayName())
  const [nameInput, setNameInput] = useState('')
  const [myStats, setMyStats] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(guesses))
  }, [guesses, storageKey])

  async function loadLeaderboard() {
    const { data } = await supabase
      .from('game_results')
      .select('guesses, game_participants(display_name, current_streak)')
      .eq('play_date', todayISO())
      .order('guesses', { ascending: true })
    setLeaderboard(data || [])
  }

  useEffect(() => {
    loadLeaderboard()
  }, [dayKey])

  const won = guesses.some(g => g.name === answer?.name)

  useEffect(() => {
    if (!won || !displayName || submitted) return
    submitResult(displayName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won, displayName, submitted])

  async function submitResult(name) {
    setSubmitted(true)
    try {
      const deviceId = getDeviceId()
      const playDate = todayISO()
      const yesterday = isoDateOffset(playDate, -1)

      const { data: existing } = await supabase
        .from('game_participants')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle()

      let streak = 1
      if (existing) {
        if (existing.last_played_date === yesterday) streak = existing.current_streak + 1
        else if (existing.last_played_date === playDate) streak = existing.current_streak
        else streak = 1
      }

      const { data: participant } = await supabase
        .from('game_participants')
        .upsert(
          { device_id: deviceId, display_name: name, current_streak: streak, last_played_date: playDate },
          { onConflict: 'device_id' }
        )
        .select()
        .single()

      await supabase
        .from('game_results')
        .upsert(
          { participant_id: participant.id, play_date: playDate, guesses: guesses.length },
          { onConflict: 'participant_id,play_date' }
        )

      const { data: myResults } = await supabase
        .from('game_results')
        .select('guesses')
        .eq('participant_id', participant.id)

      const avg = myResults.reduce((sum, r) => sum + r.guesses, 0) / myResults.length
      setMyStats({ avg, streak })
      loadLeaderboard()
    } catch (err) {
      console.error('Failed to submit leaderboard result', err)
    }
  }

  function handleNameSubmit(e) {
    e.preventDefault()
    const trimmed = nameInput.trim().slice(0, 24)
    if (!trimmed) return
    saveDisplayName(trimmed)
    setDisplayNameState(trimmed)
  }

  if (players === null || answer === null) {
    return (
      <div className="pt-24 pb-24 max-w-2xl mx-auto px-4 flex justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    )
  }

  const guessedNames = new Set(guesses.map(g => g.name))
  const options = query.trim()
    ? players
        .filter(p => p.name.toLowerCase().includes(query.trim().toLowerCase()) && !guessedNames.has(p.name))
        .slice(0, 8)
    : []

  const blurPercent = won ? 0 : Math.max(0, 100 - guesses.length * 5)
  const blurPx = (blurPercent / 100) * MAX_BLUR_PX

  function submitGuess(player) {
    if (won || guessedNames.has(player.name)) return
    setGuesses(g => [player, ...g])
    setQuery('')
    setShowOptions(false)
  }

  return (
    <>
      <PageMeta title="Spitfiredle" description="Guess today's Southampton Spitfires player from their stats." />
      <Helmet>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="pt-24 pb-24 max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <p className="text-[#641e31] text-xs font-black uppercase tracking-[0.3em] mb-2">
            Southampton Spitfires
          </p>
          <h1 className="text-white text-4xl sm:text-5xl font-black uppercase tracking-tight">
            Spitfiredle
          </h1>
          <p className="text-white/40 mt-3 text-sm leading-relaxed">
            One player a day. Guess based on games played, goals, assists, PIMs, years in the club, and country.
          </p>
        </div>

        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative h-40 w-40 rounded-full overflow-hidden border border-white/10 bg-white/5">
            {answer.photo_url ? (
              <img
                src={answer.photo_url}
                alt={won ? answer.name : 'Mystery Spitfire'}
                style={{ filter: `blur(${blurPx}px)`, transform: 'scale(1.15)' }}
                className="h-full w-full object-cover transition-[filter] duration-500"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-white/20 text-4xl font-black">?</div>
            )}
          </div>
          {won ? (
            <p className="text-white font-black uppercase tracking-wide text-lg">{answer.name}</p>
          ) : (
            <p className="text-white/30 text-xs uppercase tracking-widest">{blurPercent}% blurred</p>
          )}
        </div>

        {!won && (
          <div className="relative mb-8">
            <input
              type="text"
              aria-label="Guess a player"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowOptions(true) }}
              onFocus={() => setShowOptions(true)}
              onBlur={() => setTimeout(() => setShowOptions(false), 150)}
              placeholder="Type a player's name…"
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#641e31] transition-colors"
            />
            {showOptions && options.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-[#111827] border border-white/10 rounded-lg overflow-hidden">
                {options.map(p => (
                  <li key={p.name}>
                    <button
                      type="button"
                      onClick={() => submitGuess(p)}
                      className="w-full text-left px-4 py-2 text-white text-sm hover:bg-white/10 transition-colors"
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {won && (
          <div className="mb-8 bg-[#641e31]/20 border border-[#641e31]/40 rounded-lg px-5 py-4">
            <p className="text-white font-black uppercase tracking-wide text-sm">
              You got it in {guesses.length} guess{guesses.length === 1 ? '' : 'es'}!
            </p>

            {!displayName && (
              <form onSubmit={handleNameSubmit} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="Enter a name to join the leaderboard…"
                  maxLength={24}
                  className="flex-1 bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#641e31] transition-colors"
                />
                <button
                  type="submit"
                  className="bg-[#641e31] text-white text-xs font-black uppercase tracking-wide px-4 py-2 rounded-lg hover:bg-[#7a2740] transition-colors"
                >
                  Join
                </button>
              </form>
            )}

            {displayName && myStats && (
              <p className="text-white/40 text-xs mt-2">
                Playing as <span className="text-white/70 font-bold">{displayName}</span> · Average {myStats.avg.toFixed(1)} guesses · Streak {myStats.streak} 🔥
              </p>
            )}

            <p className="text-white/40 text-xs mt-1">Come back tomorrow for the next Spitfire.</p>
          </div>
        )}

        {leaderboard.length > 0 && (
          <div className="mb-8">
            <h2 className="text-white/40 text-xs font-black uppercase tracking-widest mb-3">
              Today's Leaderboard
            </h2>
            <div className="space-y-1.5">
              {leaderboard.map((row, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2">
                  <span className="text-white/70 text-sm">
                    <span className="text-white/30 font-mono mr-2">{i + 1}.</span>
                    {row.game_participants?.display_name}
                  </span>
                  <span className="flex items-center gap-3 text-white/50 font-mono text-xs">
                    <span>{row.guesses} guess{row.guesses === 1 ? '' : 'es'}</span>
                    {row.game_participants?.current_streak > 0 && <span>🔥 {row.game_participants.current_streak}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {guesses.length > 0 && (
          <div className="space-y-3">
            {guesses.map(g => {
              const countryMatch = g.country === answer.country
              return (
                <div key={g.name} className="border border-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold text-sm">{g.name}</span>
                    <span className={`inline-flex items-center gap-1.5 font-bold text-sm ${countryMatch ? 'text-green-400' : 'text-red-400'}`}>
                      {flagUrl(g.country) && (
                        <img src={flagUrl(g.country)} alt={g.country} className="h-3.5 w-auto rounded-[2px]" />
                      )}
                      {countryMatch ? '✓' : '✕'}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {STAT_FIELDS.map(f => {
                      const cmp = compareNumber(g[f.key], answer[f.key])
                      return (
                        <div key={f.key} className="bg-white/5 rounded px-1 py-1.5 text-center">
                          <p className="text-white/40 text-[9px] uppercase tracking-wider mb-0.5">{f.label}</p>
                          <p className={`font-mono text-xs sm:text-sm ${cmp === 'match' ? 'text-green-400' : 'text-white/70'}`}>
                            {g[f.key]}{cmp === 'higher' ? ' ↑' : cmp === 'lower' ? ' ↓' : ''}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
