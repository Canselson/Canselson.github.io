import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { MapPin, Clock, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TEAM_NAMES = {
  'a-team': 'A Team',
  'b-team': 'B Team',
  'c-team': 'C Team',
  'd-team': 'D Team',
  'womens': "Women's",
}

function youTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

export default function TrainingPage() {
  const { eventId } = useParams()
  const [event,    setEvent]    = useState(null)
  const [sections, setSections] = useState([])
  const [hasPlan,  setHasPlan]  = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: ev }, { data: plan }] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('training_plans')
          .select('id, training_sections(*)')
          .eq('event_id', eventId)
          .maybeSingle(),
      ])
      setEvent(ev)
      if (plan) {
        setHasPlan(true)
        const sorted = (plan.training_sections || []).toSorted((a, b) => a.sort_order - b.sort_order)
        setSections(sorted)
      }
      setLoading(false)
    }
    load()
  }, [eventId])

  if (loading) {
    return (
      <div className="pt-32 pb-24 max-w-3xl mx-auto px-4">
        <div className="h-6 bg-white/5 rounded animate-pulse mb-6 w-32" />
        <div className="h-10 bg-white/5 rounded animate-pulse mb-3 w-64" />
        <div className="h-4 bg-white/5 rounded animate-pulse w-48" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="pt-32 pb-24 max-w-3xl mx-auto px-4">
        <p className="text-white/40 text-sm">Event not found.</p>
      </div>
    )
  }

  const date  = new Date(event.starts_at)
  const title = event.title || 'Training Session'
  const team  = event.team ? (TEAM_NAMES[event.team] ?? event.team) : null

  return (
    <div className="pt-24 pb-24 max-w-3xl mx-auto px-4">
      <Link
        to="/calendar"
        className="text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors mb-8 inline-block"
      >
        ← Calendar
      </Link>

      {/* Event header */}
      <div className="mb-10">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className="text-white text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider"
            style={{ backgroundColor: '#1a5c2a' }}
          >
            Training
          </span>
          {team && (
            <span className="text-white/40 text-xs font-bold uppercase tracking-wider">{team}</span>
          )}
        </div>
        <h1 className="text-white text-3xl sm:text-4xl font-black uppercase tracking-tight mb-4">
          {title}
        </h1>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-white/40 text-sm">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={14} />
            {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} />
            {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {event.location && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              {event.location}
            </span>
          )}
        </div>
        {event.description && (
          <p className="text-white/50 text-sm mt-4 leading-relaxed">{event.description}</p>
        )}
      </div>

      {/* Plan content */}
      {!hasPlan || sections.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-2xl py-16 text-center">
          <p className="text-white/25 text-sm">No training plan has been added for this session yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {sections.map((section, i) => (
            <PlanSection key={section.id} section={section} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlanSection({ section, index }) {
  const videoId   = youTubeId(section.video_url)
  const hasContent = section.heading || section.body || section.image_url || videoId
  if (!hasContent) return null

  return (
    <div>
      {index > 0 && <div className="h-px bg-white/10 -mt-2 mb-10" />}

      {section.heading && (
        <h2 className="text-white text-xl font-black uppercase tracking-tight mb-3">
          {section.heading}
        </h2>
      )}

      {section.body && (
        <p className="text-white/60 text-sm leading-relaxed mb-5 whitespace-pre-line">
          {section.body}
        </p>
      )}

      {section.image_url && (
        <div className="rounded-xl overflow-hidden mb-5 bg-[#111827] border border-white/10">
          <img src={section.image_url} alt="" className="w-full object-contain max-h-[420px]" />
        </div>
      )}

      {videoId && (
        <div className="relative rounded-xl overflow-hidden aspect-video bg-[#111827] border border-white/10">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-popups allow-forms allow-presentation"
            title={section.heading || `Section ${index + 1}`}
          />
        </div>
      )}
    </div>
  )
}
