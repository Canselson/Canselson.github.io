import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Clock, CalendarDays, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ─── To add a new event category:
//     1. Add one entry here
//     2. Run in Supabase SQL editor:
//        ALTER TABLE events DROP CONSTRAINT events_type_check;
//        ALTER TABLE events ADD CONSTRAINT events_type_check
//          CHECK (type IN ('game','social','training','other','<new_type>'));
// ─────────────────────────────────────────────────────────────────────────────
const EVENT_TYPES = {
  game:     { label: 'Game',     color: '#00436b' },
  social:   { label: 'Social',   color: '#641e31' },
  training: { label: 'Training', color: '#1a5c2a' },
  other:    { label: 'Other',    color: '#5c4a1a' },
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function CalendarPage() {
  const today = new Date()

  const [viewDate,     setViewDate]     = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [events,       setEvents]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [activeFilter, setActiveFilter] = useState(null)   // null = All
  const [selectedDay,  setSelectedDay]  = useState(today.getDate())

  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setEvents(data || [])
        setLoading(false)
      })
  }, [])

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    setSelectedDay(null)
  }
  function nextMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    setSelectedDay(null)
  }
  function handleFilterClick(type) {
    setActiveFilter(prev => (prev === type ? null : type))
  }
  function handleDayClick(day) {
    setSelectedDay(prev => (prev === day ? null : day))
  }

  const filteredEvents = activeFilter
    ? events.filter(ev => ev.type === activeFilter)
    : events

  function eventsOnDay(day) {
    if (!day) return []
    const cellDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    return filteredEvents.filter(ev => {
      const evStart     = new Date(ev.starts_at)
      const evStartDate = new Date(evStart.getFullYear(), evStart.getMonth(), evStart.getDate())
      if (!ev.ends_at) return evStartDate.getTime() === cellDate.getTime()
      const evEnd     = new Date(ev.ends_at)
      const evEndDate = new Date(evEnd.getFullYear(), evEnd.getMonth(), evEnd.getDate())
      if (evStartDate.getTime() === evEndDate.getTime()) return evStartDate.getTime() === cellDate.getTime()
      return cellDate >= evStartDate && cellDate <= evEndDate
    })
  }

  const calendarCells  = getCalendarCells(viewDate.getFullYear(), viewDate.getMonth())
  const selectedEvents = selectedDay ? eventsOnDay(selectedDay) : []
  const isCurrentMonth =
    viewDate.getFullYear() === today.getFullYear() &&
    viewDate.getMonth()    === today.getMonth()

  return (
    <div className="pt-24 pb-24 max-w-3xl mx-auto px-4">

      {/* Page header */}
      <div className="mb-8">
        <p className="text-[#641e31] text-xs font-black uppercase tracking-[0.3em] mb-2">
          Southampton Spitfires
        </p>
        <h1 className="text-white text-4xl sm:text-5xl font-black uppercase tracking-tight">
          Calendar
        </h1>
        <p className="text-white/40 mt-3 text-sm">
          Games and events — subscribe to sync automatically with your calendar app.
        </p>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveFilter(null)}
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
            activeFilter === null
              ? 'bg-white/20 text-white'
              : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
          }`}
        >
          All
        </button>
        {Object.entries(EVENT_TYPES).map(([type, { label, color }]) => (
          <button
            key={type}
            onClick={() => handleFilterClick(type)}
            className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all"
            style={
              activeFilter === type
                ? { backgroundColor: color, color: '#fff' }
                : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.38)' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Calendar card */}
      <div className="bg-[#111827] border border-white/10 rounded-2xl overflow-hidden">

        {/* Month navigation */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-white font-black uppercase tracking-widest text-sm">
            {viewDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-white/10">
          {DAY_HEADERS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-black uppercase tracking-widest text-white/25">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        {loading ? (
          <div className="py-16 text-center text-white/30 text-sm tracking-widest uppercase">Loading…</div>
        ) : error ? (
          <div className="py-16 text-center text-red-400/70 text-sm">{error}</div>
        ) : (
          <div className="grid grid-cols-7 p-2 gap-1">
            {calendarCells.map((day, i) => (
              <DayCell
                key={i}
                day={day}
                events={eventsOnDay(day)}
                isToday={isCurrentMonth && day === today.getDate()}
                isSelected={day === selectedDay}
                onClick={handleDayClick}
              />
            ))}
          </div>
        )}

        {/* Selected day panel */}
        {selectedDay !== null && (
          <SelectedDayPanel
            day={selectedDay}
            viewDate={viewDate}
            events={selectedEvents}
          />
        )}
      </div>

      {/* Subscribe section */}
      <SubscribeSection />
    </div>
  )
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

function DayCell({ day, events, isToday, isSelected, onClick }) {
  if (!day) return <div className="min-h-[4.5rem] sm:min-h-[5.5rem]" />

  return (
    <button
      onClick={() => onClick(day)}
      className={`min-h-[4.5rem] sm:min-h-[5.5rem] rounded-xl p-1.5 sm:p-2 text-left w-full
        transition-all duration-150
        ${isSelected ? 'bg-[#00436b]/40 ring-1 ring-[#00436b]' : 'hover:bg-white/5'}`}
    >
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold transition-colors
          ${isToday ? 'bg-[#641e31] text-white' : isSelected ? 'text-white' : 'text-white/50'}`}
      >
        {day}
      </span>

      {events.length > 0 && (
        <div className="flex gap-0.5 mt-1.5 flex-wrap px-0.5">
          {events.slice(0, 3).map((ev, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0"
              style={{ backgroundColor: EVENT_TYPES[ev.type]?.color ?? '#555' }}
            />
          ))}
          {events.length > 3 && (
            <span className="text-white/30 text-xs leading-none ml-0.5">+{events.length - 3}</span>
          )}
        </div>
      )}
    </button>
  )
}

// ─── Selected day panel ───────────────────────────────────────────────────────

function SelectedDayPanel({ day, viewDate, events }) {
  const date  = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
  const label = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="border-t border-white/10 p-5">
      <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-4">{label}</p>
      {events.length === 0 ? (
        <p className="text-white/20 text-sm py-1">No events on this day.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map(ev => <EventCard key={ev.id} event={ev} />)}
        </div>
      )}
    </div>
  )
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }) {
  const start    = new Date(event.starts_at)
  const end      = event.ends_at ? new Date(event.ends_at) : null
  const isMulti  = end && end.toDateString() !== start.toDateString()
  const time     = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const isGame   = event.type === 'game'
  const title    = isGame ? `vs ${event.opponent}` : event.title
  const cfg      = EVENT_TYPES[event.type] ?? { label: event.type, color: '#555' }

  return (
    <div className="flex gap-4 bg-[#0d1520] border border-white/10 rounded-xl p-4">
      {/* Date block */}
      <div className="flex flex-col items-center justify-center w-12 shrink-0 text-center">
        <span className="text-xs font-black uppercase tracking-wider" style={{ color: cfg.color }}>
          {start.toLocaleDateString('en-GB', { month: 'short' })}
        </span>
        <span className="text-white text-2xl font-black leading-none">{start.getDate()}</span>
      </div>
      <div className="w-px bg-white/10 shrink-0" />

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            <p className="text-white font-bold leading-tight">{title}</p>
            {isGame && event.team && (
              <p className="text-white/40 text-xs mt-0.5">{teamName(event.team)}</p>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Badge label={cfg.label} color={cfg.color} />
            {isGame && event.home_away && (
              <Badge
                label={event.home_away === 'home' ? 'Home' : 'Away'}
                color={event.home_away === 'home' ? '#003a5c' : '#4a1525'}
              />
            )}
            {isMulti && <Badge label="Multi-day" color="#374151" />}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-white/40 text-xs">
          {isMulti ? (
            <span className="flex items-center gap-1">
              <CalendarDays size={11} />
              {fmtDate(start)} – {fmtDate(end)}
            </span>
          ) : (
            <span className="flex items-center gap-1"><Clock size={11} />{time}</span>
          )}
          {event.location && (
            <span className="flex items-center gap-1"><MapPin size={11} />{event.location}</span>
          )}
        </div>
        {event.description && (
          <p className="text-white/30 text-xs mt-2 line-clamp-2">{event.description}</p>
        )}
      </div>
    </div>
  )
}

function Badge({ label, color }) {
  return (
    <span
      className="text-white text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  )
}

// ─── Subscribe section ────────────────────────────────────────────────────────

const ICS_URL = 'https://www.southamptonspitfires.me/api/ics'

function SubscribeSection() {
  const [copied, setCopied] = useState(false)

  function copyURL() {
    navigator.clipboard.writeText(ICS_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const webcalURL  = ICS_URL.replace('https://', 'webcal://')
  const googleURL  = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalURL)}`
  const outlookURL = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(webcalURL)}`

  return (
    <div className="bg-[#111827] border border-white/10 rounded-xl px-5 py-4 mt-6 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest mr-1 shrink-0">
        <CalendarDays size={14} />
        Subscribe:
      </div>
      <a href={googleURL} target="_blank" rel="noopener noreferrer"
        className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-80"
        style={{ backgroundColor: '#4285F4' }}>
        Google
      </a>
      <a href={outlookURL} target="_blank" rel="noopener noreferrer"
        className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-80"
        style={{ backgroundColor: '#0078D4' }}>
        Outlook
      </a>
      <a href={webcalURL}
        className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white bg-[#1d1d1f] border border-white/10 hover:bg-[#2d2d2f] transition-colors">
        Apple
      </a>
      <button onClick={copyURL}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white/50 bg-white/5 border border-white/10 hover:text-white hover:bg-white/10 transition-colors">
        {copied ? <><Check size={11} />Copied</> : <><Copy size={11} />Copy URL</>}
      </button>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCalendarCells(year, month) {
  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells       = Array(firstDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function fmtDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const TEAM_NAMES = {
  'a-team': 'A Team',
  'b-team': 'B Team',
  'c-team': 'C Team',
  'd-team': 'D Team',
  'womens': "Women's",
}

function teamName(slug) {
  return TEAM_NAMES[slug] ?? slug
}
