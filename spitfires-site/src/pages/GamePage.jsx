import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

const PHOTO_WIDTH = 148
const PHOTO_HEIGHT = 185
const PHOTO_TOTAL_PIXELS = PHOTO_WIDTH * PHOTO_HEIGHT

// Splits a target block count into a width x height grid matching the
// photo's aspect ratio, so blocks stay roughly square instead of one
// giant horizontal or vertical stripe.
function pixelBlockDims(blockCount) {
  const aspect = PHOTO_WIDTH / PHOTO_HEIGHT
  const w = Math.min(PHOTO_WIDTH, Math.max(1, Math.round(Math.sqrt(blockCount * aspect))))
  const h = Math.min(PHOTO_HEIGHT, Math.max(1, Math.round(blockCount / w)))
  return { w, h }
}

// Downscales the image to a tiny w x h grid (averaging each block's
// color) then scales it back up with smoothing disabled, so each
// source block renders as a single hard-edged square.
function drawPixelated(canvas, image, blockCount) {
  const { w, h } = pixelBlockDims(blockCount)
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  off.getContext('2d').drawImage(image, 0, 0, w, h)

  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(off, 0, 0, w, h, 0, 0, canvas.width, canvas.height)
}

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

// Salt for the shuffle seed. Bump this to reshuffle which player lands on
// which day (e.g. to move a photo-less player off today) without breaking
// the no-repeat-until-full-cycle guarantee.
const SHUFFLE_SALT = 1

// Cycles through every player once (in a shuffled, seeded-per-cycle order)
// before any player repeats as the daily answer.
function dailyPlayerIndex(length) {
  const day = dayNumber()
  const cycle = Math.floor(day / length)
  const position = day % length
  return seededShuffle(length, cycle + SHUFFLE_SALT)[position]
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
  const [myParticipantId, setMyParticipantId] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [submitted, setSubmitted] = useState(false)

  const leaderboardRef = useRef(null)
  const rowRefs = useRef({})
  const hasCenteredRef = useRef(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(guesses))
  }, [guesses, storageKey])

  async function loadLeaderboard() {
    const { data } = await supabase
      .from('game_results')
      .select('participant_id, guesses, game_participants(display_name, current_streak)')
      .eq('play_date', todayISO())
      .order('guesses', { ascending: true })
    setLeaderboard(data || [])
  }

  useEffect(() => {
    loadLeaderboard()
  }, [dayKey])

  // Centers the leaderboard scroll position on the current player's row,
  // once, the first time both are available — later leaderboard refreshes
  // don't yank the scroll position away from wherever the user left it.
  useLayoutEffect(() => {
    if (hasCenteredRef.current || !myParticipantId) return
    const container = leaderboardRef.current
    const row = rowRefs.current[myParticipantId]
    if (!container || !row) return
    container.scrollTop = Math.max(0, row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2)
    hasCenteredRef.current = true
  }, [leaderboard, myParticipantId])

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
      setMyParticipantId(participant.id)
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

  // Block count doubles with each guess, starting from a single block
  // (one flat color) and reaching full photo resolution around guess 15.
  const blockCount = won ? PHOTO_TOTAL_PIXELS : Math.min(2 ** guesses.length, PHOTO_TOTAL_PIXELS)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !answer?.photo_url) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled) drawPixelated(canvas, img, blockCount)
    }
    img.src = answer.photo_url
    return () => { cancelled = true }
  }, [answer?.photo_url, blockCount])

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

  const pixelatedPercent = Math.max(0, 100 - Math.round((blockCount / PHOTO_TOTAL_PIXELS) * 100))

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
            One player a day. Guess based on games played, goals, assists, PIMs, years in BUIHA, and country.
          </p>
        </div>

        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative w-[148px] h-[185px] border border-white/10 bg-white/5">
            {answer.photo_url ? (
              <canvas
                ref={canvasRef}
                width={PHOTO_WIDTH}
                height={PHOTO_HEIGHT}
                role="img"
                aria-label={won ? answer.name : 'Mystery Spitfire'}
                style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                className="h-full w-full select-none"
                onContextMenu={e => e.preventDefault()}
                onDragStart={e => e.preventDefault()}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-white/20 text-4xl font-black">?</div>
            )}
          </div>
          {won ? (
            <p className="text-white font-black uppercase tracking-wide text-lg">{answer.name}</p>
          ) : (
            <p className="text-white/30 text-xs uppercase tracking-widest">{pixelatedPercent}% pixelated</p>
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
            <div ref={leaderboardRef} className="max-h-[228px] overflow-y-auto space-y-1.5 pr-1">
              {leaderboard.map((row, i) => {
                const isMe = row.participant_id === myParticipantId
                return (
                  <div
                    key={row.participant_id}
                    ref={el => { rowRefs.current[row.participant_id] = el }}
                    className={`flex items-center justify-between rounded-lg px-4 py-2 ${isMe ? 'bg-[#641e31]/20 border border-[#641e31]/40' : 'bg-white/5'}`}
                  >
                    <span className="text-white/70 text-sm">
                      <span className="text-white/30 font-mono mr-2">{i + 1}.</span>
                      {row.game_participants?.display_name}
                    </span>
                    <span className="flex items-center gap-3 text-white/50 font-mono text-xs">
                      <span>{row.guesses} guess{row.guesses === 1 ? '' : 'es'}</span>
                      {row.game_participants?.current_streak > 0 && <span>🔥 {row.game_participants.current_streak}</span>}
                    </span>
                  </div>
                )
              })}
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
