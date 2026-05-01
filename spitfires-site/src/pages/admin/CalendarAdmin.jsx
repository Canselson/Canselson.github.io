import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, X, AlertTriangle, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const EVENT_TYPES = {
  game:     { label: 'Game',     color: '#00436b' },
  social:   { label: 'Social',   color: '#641e31' },
  training: { label: 'Training', color: '#1a5c2a' },
  other:    { label: 'Other',    color: '#5c4a1a' },
}

const TEAMS = [
  { slug: 'a-team',  name: 'A Team'  },
  { slug: 'b-team',  name: 'B Team'  },
  { slug: 'c-team',  name: 'C Team'  },
  { slug: 'd-team',  name: 'D Team'  },
  { slug: 'womens',  name: "Women's" },
]

const EMPTY_FORM = {
  type:        'game',
  team:        'a-team',
  title:       '',
  opponent:    '',
  home_away:   'home',
  startDate:   '',
  startTime:   '',
  endDate:     '',
  endTime:     '',
  location:    '',
  description: '',
}

export default function CalendarAdmin() {
  const navigate = useNavigate()
  const [events,      setEvents]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [panelEvent,  setPanelEvent]  = useState(null)  // null=closed, EMPTY_FORM=new, populated=edit
  const [deleteTarget, setDeleteTarget] = useState(null) // event to confirm-delete

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  function openNew()        { setPanelEvent(EMPTY_FORM) }
  function openEdit(ev)     { setPanelEvent(eventToForm(ev)) }
  function closePanel()     { setPanelEvent(null) }
  function afterSave()      { closePanel(); loadEvents() }
  function afterDelete()    { setDeleteTarget(null); loadEvents() }

  const now = new Date()
  const upcoming = events.filter(ev => new Date(ev.starts_at) >= now)
  const past     = events.filter(ev => new Date(ev.starts_at) <  now)

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white text-2xl font-black uppercase tracking-tight">Calendar</h1>
          <p className="text-white/40 text-sm mt-1">Manage events, fixtures and socials</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#00436b] hover:bg-[#005a8f] text-white text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={14} /> Add Event
        </button>
      </div>

      {loading ? (
        <LoadingRows />
      ) : (
        <>
          <EventSection
            title="Upcoming"
            events={upcoming}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            emptyText="No upcoming events — add one above."
          />
          {past.length > 0 && (
            <EventSection
              title="Past"
              events={[...past].reverse()}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onReport={ev => navigate(`/admin/reports/${ev.id}`)}
              dimmed
            />
          )}
        </>
      )}

      {/* Add / Edit panel */}
      {panelEvent !== null && (
        <EventFormPanel
          initial={panelEvent}
          onClose={closePanel}
          onSaved={afterSave}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteModal
          event={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={afterDelete}
        />
      )}
    </div>
  )
}

// ─── Event list section ───────────────────────────────────────────────────────

function EventSection({ title, events, onEdit, onDelete, onReport, emptyText, dimmed = false }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-white/30">{title}</h2>
        <div className="h-px flex-1 bg-white/5" />
      </div>
      {events.length === 0 && emptyText ? (
        <p className="text-white/20 text-sm py-4">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map(ev => (
            <EventRow
              key={ev.id}
              event={ev}
              onEdit={onEdit}
              onDelete={onDelete}
              onReport={onReport}
              dimmed={dimmed}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EventRow({ event, onEdit, onDelete, onReport, dimmed }) {
  const start  = new Date(event.starts_at)
  const end    = event.ends_at ? new Date(event.ends_at) : null
  const isMulti = end && end.toDateString() !== start.toDateString()
  const cfg    = EVENT_TYPES[event.type] ?? { label: event.type, color: '#555' }
  const title  = event.type === 'game' ? `vs ${event.opponent}` : event.title

  return (
    <div
      className={`flex items-center gap-4 bg-[#111827] border border-white/10 rounded-xl px-4 py-3 ${
        dimmed ? 'opacity-50' : ''
      }`}
    >
      {/* Date */}
      <div className="w-20 shrink-0 text-xs text-white/40">
        <p className="font-bold text-white/70">
          {start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </p>
        <p>{isMulti
          ? `– ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
          : start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        }</p>
      </div>

      {/* Type badge */}
      <span
        className="text-white text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shrink-0 hidden sm:block"
        style={{ backgroundColor: cfg.color }}
      >
        {cfg.label}
      </span>

      {/* Title + team */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{title}</p>
        {event.type === 'game' && event.team && (
          <p className="text-white/35 text-xs truncate">
            {TEAMS.find(t => t.slug === event.team)?.name ?? event.team}
          </p>
        )}
      </div>

      {/* H/A for games */}
      {event.type === 'game' && event.home_away && (
        <span className="text-white/40 text-xs font-bold uppercase tracking-wider shrink-0 hidden md:block">
          {event.home_away}
        </span>
      )}

      {/* Location */}
      {event.location && (
        <span className="text-white/30 text-xs truncate max-w-[140px] hidden lg:block">
          {event.location}
        </span>
      )}

      {/* Actions */}
      <div className="flex gap-1 shrink-0 ml-auto">
        {dimmed && event.type === 'game' && onReport && (
          <button
            onClick={() => onReport(event)}
            title="Edit match report"
            className="p-2 rounded-lg text-white/40 hover:text-[#7ec8e3] hover:bg-[#00436b]/20 transition-colors"
          >
            <FileText size={14} />
          </button>
        )}
        <button
          onClick={() => onEdit(event)}
          className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onDelete(event)}
          className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Add / Edit form panel ────────────────────────────────────────────────────

function EventFormPanel({ initial, onClose, onSaved }) {
  const isNew = !initial.id
  const [form,    setForm]    = useState(initial)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validate(form)
    if (validationError) { setError(validationError); return }
    setSaving(true)
    setError(null)
    const payload = formToPayload(form)
    const { error } = isNew
      ? await supabase.from('events').insert(payload)
      : await supabase.from('events').update(payload).eq('id', initial.id)
    if (error) { setError(error.message); setSaving(false); return }
    onSaved()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-[#111827] border-l border-white/10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-white font-black uppercase tracking-widest text-sm">
            {isNew ? 'Add Event' : 'Edit Event'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">

          {/* Type */}
          <Field label="Event Type">
            <div className="flex flex-wrap gap-2">
              {Object.entries(EVENT_TYPES).map(([type, { label, color }]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                  style={
                    form.type === type
                      ? { backgroundColor: color, color: '#fff' }
                      : { backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {/* Title or Opponent */}
          {form.type === 'game' ? (
            <>
              <Field label="Team *">
                <div className="flex flex-wrap gap-2">
                  {TEAMS.map(t => (
                    <button
                      key={t.slug}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, team: t.slug }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        form.team === t.slug
                          ? 'bg-white/20 text-white'
                          : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Opponent *">
                <TextInput value={form.opponent} onChange={set('opponent')} placeholder="e.g. Bristol" />
              </Field>
              <Field label="Home or Away *">
                <div className="flex gap-2">
                  {['home', 'away'].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, home_away: v }))}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                        form.home_away === v
                          ? 'bg-[#00436b] text-white'
                          : 'bg-white/5 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          ) : (
            <Field label="Title *">
              <TextInput value={form.title} onChange={set('title')} placeholder="Event name" />
            </Field>
          )}

          {/* Start date + time */}
          <Field label="Start *">
            <div className="flex gap-2">
              <input
                type="date"
                value={form.startDate}
                onChange={set('startDate')}
                required
                className={inputClass}
              />
              <input
                type="time"
                value={form.startTime}
                onChange={set('startTime')}
                required
                className={`${inputClass} w-32 shrink-0`}
              />
            </div>
          </Field>

          {/* End date + time (optional) */}
          <Field label="End (leave blank for single-day)">
            <div className="flex gap-2">
              <input
                type="date"
                value={form.endDate}
                onChange={set('endDate')}
                className={inputClass}
              />
              <input
                type="time"
                value={form.endTime}
                onChange={set('endTime')}
                className={`${inputClass} w-32 shrink-0`}
              />
            </div>
          </Field>

          {/* Location */}
          <Field label="Location">
            <TextInput value={form.location} onChange={set('location')} placeholder="e.g. Planet Ice Southampton" />
          </Field>

          {/* Description */}
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={3}
              placeholder="Optional extra details"
              className={`${inputClass} resize-none`}
            />
          </Field>

          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-2 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-widest text-white/50 bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-widest text-white bg-[#00436b] hover:bg-[#005a8f] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isNew ? 'Add Event' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteModal({ event, onCancel, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const title = event.type === 'game' ? `vs ${event.opponent}` : event.title

  async function confirm() {
    setDeleting(true)
    await supabase.from('events').delete().eq('id', event.id)
    onDeleted()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[400px] bg-[#111827] border border-white/10 rounded-2xl p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-2 rounded-lg bg-red-400/10 shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-white font-bold mb-1">Delete event?</p>
            <p className="text-white/50 text-sm">
              "<span className="text-white/80">{title}</span>" will be permanently removed.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white/50 bg-white/5 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Small reusable pieces ────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-white/50 text-xs font-bold uppercase tracking-widest">{label}</span>
      {children}
    </div>
  )
}

const inputClass =
  'w-full bg-[#0a0f1a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00436b] transition-colors'

function TextInput(props) {
  return <input type="text" className={inputClass} {...props} />
}

function LoadingRows() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 bg-[#111827] border border-white/10 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eventToForm(ev) {
  const start = new Date(ev.starts_at)
  const end   = ev.ends_at ? new Date(ev.ends_at) : null
  return {
    id:          ev.id,
    type:        ev.type,
    team:        ev.team        ?? 'a-team',
    title:       ev.title       ?? '',
    opponent:    ev.opponent    ?? '',
    home_away:   ev.home_away   ?? 'home',
    startDate:   toDateInput(start),
    startTime:   toTimeInput(start),
    endDate:     end ? toDateInput(end) : '',
    endTime:     end ? toTimeInput(end) : '',
    location:    ev.location    ?? '',
    description: ev.description ?? '',
  }
}

function formToPayload(form) {
  const starts_at = new Date(`${form.startDate}T${form.startTime}`).toISOString()
  const ends_at   = form.endDate && form.endTime
    ? new Date(`${form.endDate}T${form.endTime}`).toISOString()
    : null

  return {
    type:        form.type,
    team:        form.type === 'game' ? form.team      : null,
    title:       form.type === 'game' ? `vs ${form.opponent}` : form.title,
    opponent:    form.type === 'game' ? form.opponent  : null,
    home_away:   form.type === 'game' ? form.home_away : null,
    starts_at,
    ends_at,
    location:    form.location    || null,
    description: form.description || null,
  }
}

function validate(form) {
  if (!form.startDate || !form.startTime) return 'Start date and time are required.'
  if (form.type === 'game' && !form.team)            return 'Please select a team.'
  if (form.type === 'game' && !form.opponent.trim()) return 'Opponent is required for games.'
  if (form.type !== 'game' && !form.title.trim())    return 'Title is required.'
  if (Boolean(form.endDate) !== Boolean(form.endTime)) return 'Provide both an end date and end time, or neither.'
  return null
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10)
}

function toTimeInput(date) {
  return date.toTimeString().slice(0, 5)
}
