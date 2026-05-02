import { useState, useEffect, useCallback } from 'react'
import { Trash2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const SKILL_LABELS = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
}

export default function MessagesAdmin() {
  const [messages,     setMessages]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [expanded,     setExpanded]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false })
    setMessages(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function markRead(id) {
    await supabase.from('contact_messages').update({ read: true }).eq('id', id)
    setMessages(msgs => msgs.map(m => m.id === id ? { ...m, read: true } : m))
  }

  async function handleToggle(msg) {
    if (expanded === msg.id) {
      setExpanded(null)
      return
    }
    setExpanded(msg.id)
    if (!msg.read) await markRead(msg.id)
  }

  async function handleDelete(msg) {
    await supabase.from('contact_messages').delete().eq('id', msg.id)
    setMessages(msgs => msgs.filter(m => m.id !== msg.id))
    if (expanded === msg.id) setExpanded(null)
    setDeleteTarget(null)
  }

  const unreadCount = messages.filter(m => !m.read).length

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white text-2xl font-black uppercase tracking-tight">Messages</h1>
          <p className="text-white/40 text-sm mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`
              : 'All messages read'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[#111827] border border-white/10 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <p className="text-white/20 text-sm py-4">No messages yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {messages.map(msg => (
            <MessageRow
              key={msg.id}
              message={msg}
              expanded={expanded === msg.id}
              onToggle={() => handleToggle(msg)}
              onDelete={() => setDeleteTarget(msg)}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  )
}

// ─── Message row ──────────────────────────────────────────────────────────────

function MessageRow({ message, expanded, onToggle, onDelete }) {
  const words   = message.message.split(' ')
  const preview = words.slice(0, 8).join(' ') + (words.length > 8 ? '…' : '')
  const skill   = message.skill_level
    ? (SKILL_LABELS[message.skill_level] ?? message.skill_level)
    : 'N/A'
  const date = new Date(message.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const unread = !message.read

  return (
    <div className={`bg-[#111827] border rounded-xl overflow-hidden transition-colors ${
      unread ? 'border-[#641e31]/50' : 'border-white/10'
    }`}>
      {/* Row header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-white/5 transition-colors"
      >
        {/* Pulsing unread dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          {unread && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#641e31] opacity-75" />
          )}
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: unread ? '#641e31' : 'transparent' }}
          />
        </span>

        {/* Name */}
        <p className={`font-bold text-sm w-32 shrink-0 truncate ${unread ? 'text-white' : 'text-white/55'}`}>
          {message.name}
        </p>

        {/* Skill badge */}
        <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 hidden sm:block ${
          message.skill_level
            ? 'bg-[#00436b]/30 text-[#7ec8e3]'
            : 'bg-white/5 text-white/25'
        }`}>
          {skill}
        </span>

        {/* Message preview */}
        <p className="text-white/35 text-xs flex-1 min-w-0 truncate hidden md:block">{preview}</p>

        {/* Date */}
        <span className="text-white/20 text-xs shrink-0 hidden lg:block">{date}</span>

        {/* Expand chevron */}
        <span className="text-white/25 shrink-0 ml-1">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/10 px-5 py-5">
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <Detail label="Name"    value={message.name} />
            <Detail label="Mobile"  value={message.mobile} />
            <Detail label="Skill Level" value={skill} />
            {message.university && <Detail label="University" value={message.university} />}
          </div>

          <div className="bg-[#0d1520] rounded-lg p-4 mb-4">
            <p className="text-white/30 text-xs font-bold uppercase tracking-widest mb-2">Message</p>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{message.message}</p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-white/20 text-xs">
              {new Date(message.created_at).toLocaleString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
            {message.read && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 text-white/25 hover:text-red-400 text-xs font-bold uppercase tracking-widest transition-colors"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-white/30 text-xs font-bold uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-white text-sm">{value}</p>
    </div>
  )
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

function DeleteModal({ name, onCancel, onConfirm }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[380px] bg-[#111827] border border-white/10 rounded-2xl p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-2 rounded-lg bg-red-400/10 shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-white font-bold mb-1">Delete message?</p>
            <p className="text-white/50 text-sm">
              Message from <span className="text-white/80">{name}</span> will be permanently deleted.
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
            onClick={async () => { setDeleting(true); await onConfirm() }}
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
