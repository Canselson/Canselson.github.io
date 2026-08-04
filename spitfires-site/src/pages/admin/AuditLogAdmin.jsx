import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const ENTITY_LABELS = {
  event:            'Calendar Event',
  match_report:     'Match Report',
  training_plan:    'Training Plan',
  album:            'Album',
  photo:            'Photo',
  document:         'Document',
  document_version: 'Document Version',
  message:          'Message',
}

const ACTION_STYLES = {
  create: { label: 'Created', color: '#1a5c2a' },
  update: { label: 'Updated', color: '#00436b' },
  delete: { label: 'Deleted', color: '#641e31' },
}

const PAGE_SIZE = 50

export default function AuditLogAdmin() {
  const [entries,     setEntries]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(true)
  const [activeType,  setActiveType]  = useState(null)
  const [search,      setSearch]      = useState('')

  const fetchPage = useCallback(async (offset, type, term) => {
    let query = supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (type) query = query.eq('entity_type', type)
    if (term.trim()) query = query.ilike('summary', `%${term.trim()}%`)
    const { data } = await query
    return data || []
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchPage(0, activeType, search).then(data => {
      setEntries(data)
      setHasMore(data.length === PAGE_SIZE)
      setLoading(false)
    })
  }, [activeType, search, fetchPage])

  async function loadMore() {
    setLoadingMore(true)
    const data = await fetchPage(entries.length, activeType, search)
    setEntries(prev => [...prev, ...data])
    setHasMore(data.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-white text-2xl font-black uppercase tracking-tight">Audit Log</h1>
        <p className="text-white/40 text-sm mt-1">Every create, edit and delete made by admins</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveType(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
              activeType === null
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
            }`}
          >
            All
          </button>
          {Object.entries(ENTITY_LABELS).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveType(prev => (prev === type ? null : type))}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                activeType === type
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          aria-label="Search audit log"
          className="ml-auto bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-[#00436b] transition-colors w-full sm:w-56"
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 bg-[#111827] border border-white/10 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-white/20 text-sm py-4">No matching activity yet.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {entries.map(entry => <EntryRow key={entry.id} entry={entry} />)}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest text-white/50 bg-white/5 hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? 'Loading…' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EntryRow({ entry }) {
  const style       = ACTION_STYLES[entry.action] ?? { label: entry.action, color: '#555' }
  const entityLabel = ENTITY_LABELS[entry.entity_type] ?? entry.entity_type
  const date        = new Date(entry.created_at)

  return (
    <div className="flex items-center gap-3 sm:gap-4 bg-[#111827] border border-white/10 rounded-xl px-4 py-3 flex-wrap sm:flex-nowrap">
      <span className="text-white/30 text-xs shrink-0 w-32 tabular-nums">
        {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{' '}
        {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span
        className="text-white text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shrink-0"
        style={{ backgroundColor: style.color }}
      >
        {style.label}
      </span>
      <span className="text-white/40 text-xs font-bold uppercase tracking-wider shrink-0 hidden md:block w-32 truncate">
        {entityLabel}
      </span>
      <span className="text-white text-sm flex-1 min-w-0 truncate">{entry.summary}</span>
      <span className="text-white/30 text-xs shrink-0 truncate max-w-[180px]">{entry.actor_email}</span>
    </div>
  )
}
