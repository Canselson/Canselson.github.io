import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import PageMeta from '../components/PageMeta'
import { supabase } from '../lib/supabase'
import { flagUrl } from '../data/countryFlags'

const STAT_FIELDS = [
  { key: 'games_played',  label: 'Games' },
  { key: 'goals',         label: 'Goals' },
  { key: 'assists',       label: 'Assists' },
  { key: 'pims',          label: 'PIMs' },
  { key: 'years_in_club', label: 'Years' },
]

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
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

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(guesses))
  }, [guesses, storageKey])

  if (players === null || answer === null) {
    return (
      <div className="pt-24 pb-24 max-w-2xl mx-auto px-4 flex justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    )
  }

  const won = guesses.some(g => g.name === answer.name)
  const guessedNames = new Set(guesses.map(g => g.name))
  const options = query.trim()
    ? players
        .filter(p => p.name.toLowerCase().includes(query.trim().toLowerCase()) && !guessedNames.has(p.name))
        .slice(0, 8)
    : []

  function submitGuess(player) {
    if (won || guessedNames.has(player.name)) return
    setGuesses(g => [player, ...g])
    setQuery('')
    setShowOptions(false)
  }

  return (
    <>
      <PageMeta title="Guess the Spitfire" description="Guess today's Southampton Spitfires player from their stats." />
      <Helmet>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="pt-24 pb-24 max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <p className="text-[#641e31] text-xs font-black uppercase tracking-[0.3em] mb-2">
            Southampton Spitfires
          </p>
          <h1 className="text-white text-4xl sm:text-5xl font-black uppercase tracking-tight">
            Guess the Spitfire
          </h1>
          <p className="text-white/40 mt-3 text-sm leading-relaxed">
            One player a day. Guess based on games played, goals, assists, PIMs, years in the club, and country.
          </p>
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
          <div className="mb-8 bg-[#641e31]/20 border border-[#641e31]/40 rounded-lg px-5 py-4 flex items-center gap-4">
            {answer.photo_url && (
              <img
                src={answer.photo_url}
                alt={answer.name}
                className="h-16 w-16 rounded-full object-cover border border-white/10 shrink-0"
              />
            )}
            <div>
              <p className="text-white font-black uppercase tracking-wide text-sm">
                You got it in {guesses.length} guess{guesses.length === 1 ? '' : 'es'}! It was {answer.name}.
              </p>
              <p className="text-white/40 text-xs mt-1">Come back tomorrow for the next Spitfire.</p>
            </div>
          </div>
        )}

        {guesses.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="text-white/40 text-xs uppercase tracking-widest">
                  <th className="py-2 pr-3">Player</th>
                  {STAT_FIELDS.map(f => (
                    <th key={f.key} className="py-2 px-3">{f.label}</th>
                  ))}
                  <th className="py-2 pl-3">Country</th>
                </tr>
              </thead>
              <tbody>
                {guesses.map(g => (
                  <tr key={g.name} className="border-t border-white/10">
                    <td className="py-3 pr-3 text-white font-bold">{g.name}</td>
                    {STAT_FIELDS.map(f => {
                      const cmp = compareNumber(g[f.key], answer[f.key])
                      return (
                        <td key={f.key} className={`py-3 px-3 font-mono ${cmp === 'match' ? 'text-green-400' : 'text-white/70'}`}>
                          {g[f.key]}{cmp === 'higher' ? ' ↑' : cmp === 'lower' ? ' ↓' : ' ✓'}
                        </td>
                      )
                    })}
                    <td className={`py-3 pl-3 font-bold ${g.country === answer.country ? 'text-green-400' : 'text-red-400'}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {flagUrl(g.country) && (
                          <img src={flagUrl(g.country)} alt={g.country} className="h-3.5 w-auto rounded-[2px]" />
                        )}
                        {g.country === answer.country ? '✓' : '✕'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
