import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, ChevronUp, ChevronDown, Upload, X, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const BUCKET       = 'training'
const MAX_PX       = 1920
const WEBP_QUALITY = 0.82

function compressToWebP(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height))
      const w = Math.round(img.width  * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/webp', WEBP_QUALITY)
    }
    img.onerror = reject
    img.src = url
  })
}

function youTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

export default function TrainingAdmin() {
  const { eventId } = useParams()
  const navigate    = useNavigate()

  const [event,      setEvent]      = useState(null)
  const [planId,     setPlanId]     = useState(null)
  const [sections,   setSections]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [savedMsg,   setSavedMsg]   = useState(false)
  const [removedIds, setRemovedIds] = useState([])

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
        setPlanId(plan.id)
        const sorted = [...(plan.training_sections || [])].sort((a, b) => a.sort_order - b.sort_order)
        setSections(sorted.map(s => ({ ...s, _key: s.id })))
      }
      setLoading(false)
    }
    load()
  }, [eventId])

  function addSection() {
    setSections(prev => [...prev, {
      _key:       crypto.randomUUID(),
      id:         null,
      heading:    '',
      body:       '',
      image_url:  null,
      video_url:  '',
      _uploading: false,
    }])
  }

  function updateSection(key, field, value) {
    setSections(prev => prev.map(s => s._key === key ? { ...s, [field]: value } : s))
  }

  function moveSection(index, dir) {
    const next = [...sections]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setSections(next)
  }

  function removeSection(key) {
    const section = sections.find(s => s._key === key)
    if (section?.id) setRemovedIds(prev => [...prev, section.id])
    if (section?.image_url) {
      const seg = section.image_url.split(`/storage/v1/object/public/${BUCKET}/`)[1]
      if (seg) supabase.storage.from(BUCKET).remove([seg])
    }
    setSections(prev => prev.filter(s => s._key !== key))
  }

  async function handleImageUpload(key, file) {
    updateSection(key, '_uploading', true)
    try {
      const blob = await compressToWebP(file)
      const path = `${eventId}/${crypto.randomUUID()}.webp`
      const { data, error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp' })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
        setSections(prev => prev.map(s => s._key === key ? { ...s, image_url: publicUrl, _uploading: false } : s))
      } else {
        updateSection(key, '_uploading', false)
      }
    } catch {
      updateSection(key, '_uploading', false)
    }
  }

  async function handleImageRemove(key, imageUrl) {
    const seg = imageUrl.split(`/storage/v1/object/public/${BUCKET}/`)[1]
    if (seg) await supabase.storage.from(BUCKET).remove([seg])
    updateSection(key, 'image_url', null)
  }

  async function handleSave() {
    setSaving(true)

    // Get or create plan
    let pid = planId
    if (!pid) {
      const { data } = await supabase
        .from('training_plans')
        .upsert({ event_id: eventId }, { onConflict: 'event_id' })
        .select('id')
        .single()
      if (!data) { setSaving(false); return }
      pid = data.id
      setPlanId(pid)
    }

    // Delete removed sections
    if (removedIds.length > 0) {
      await supabase.from('training_sections').delete().in('id', removedIds)
      setRemovedIds([])
    }

    // Update existing sections
    const existing = sections.filter(s => s.id)
    await Promise.all(existing.map(s => {
      const idx = sections.findIndex(x => x._key === s._key)
      return supabase.from('training_sections').update({
        sort_order: idx,
        heading:    s.heading   || null,
        body:       s.body      || null,
        image_url:  s.image_url || null,
        video_url:  s.video_url || null,
      }).eq('id', s.id)
    }))

    // Insert new sections
    const newSecs = sections.filter(s => !s.id)
    if (newSecs.length > 0) {
      await supabase.from('training_sections').insert(newSecs.map(s => ({
        plan_id:    pid,
        sort_order: sections.findIndex(x => x._key === s._key),
        heading:    s.heading   || null,
        body:       s.body      || null,
        image_url:  s.image_url || null,
        video_url:  s.video_url || null,
      })))
    }

    // Re-fetch to sync DB ids into state
    const { data: fresh } = await supabase
      .from('training_sections')
      .select('*')
      .eq('plan_id', pid)
      .order('sort_order')

    setSections((fresh || []).map(s => ({ ...s, _key: s.id })))
    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  if (loading) return <div className="text-white/40 text-sm animate-pulse">Loading…</div>
  if (!event)  return <div className="text-red-400 text-sm">Event not found.</div>

  const title    = event.title || 'Training Session'
  const dateStr  = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div>
      <button
        onClick={() => navigate('/admin')}
        className="text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors mb-6 inline-block"
      >
        ← Calendar
      </button>

      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-white text-2xl font-black uppercase tracking-tight">{title}</h1>
          {dateStr && <p className="text-white/40 text-sm mt-1">{dateStr}</p>}
        </div>
        <div className="flex items-center gap-3">
          {savedMsg && (
            <span className="flex items-center gap-1.5 text-green-400 text-xs font-bold uppercase tracking-widest">
              <Check size={12} /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#00436b] hover:bg-[#005a8f] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        {sections.length === 0 && (
          <p className="text-white/20 text-sm py-4">
            No sections yet — add one below to start building the plan.
          </p>
        )}
        {sections.map((section, i) => (
          <SectionCard
            key={section._key}
            section={section}
            index={i}
            total={sections.length}
            onUpdate={(field, value) => updateSection(section._key, field, value)}
            onMove={dir => moveSection(i, dir)}
            onRemove={() => removeSection(section._key)}
            onImageUpload={file => handleImageUpload(section._key, file)}
            onImageRemove={() => handleImageRemove(section._key, section.image_url)}
          />
        ))}
      </div>

      <button
        onClick={addSection}
        className="flex items-center gap-2 w-full justify-center bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/10 hover:border-white/25 text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest px-4 py-4 rounded-xl transition-colors"
      >
        <Plus size={14} /> Add Section
      </button>
    </div>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ section, index, total, onUpdate, onMove, onRemove, onImageUpload, onImageRemove }) {
  const fileRef = useRef()
  const videoId = youTubeId(section.video_url)

  return (
    <div className="bg-[#111827] border border-white/10 rounded-xl overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#0d1520]">
        <span className="text-white/40 text-xs font-bold uppercase tracking-widest">
          Section {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="Move up"
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="Move down"
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={onRemove}
            title="Delete section"
            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors ml-1"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="p-4 flex flex-col gap-4">
        <SField label="Heading">
          <input
            type="text"
            value={section.heading || ''}
            onChange={e => onUpdate('heading', e.target.value)}
            placeholder="e.g. Warm Up, Power Play Drill…"
            className={inputClass}
          />
        </SField>

        <SField label="Notes">
          <textarea
            value={section.body || ''}
            onChange={e => onUpdate('body', e.target.value)}
            rows={4}
            placeholder="Drill description, instructions, objectives…"
            className={`${inputClass} resize-none`}
          />
        </SField>

        <SField label="Image">
          {section.image_url ? (
            <div className="relative rounded-xl overflow-hidden bg-[#0a0f1a] border border-white/10">
              <img src={section.image_url} alt="" className="w-full object-contain max-h-64" />
              <button
                onClick={onImageRemove}
                className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 rounded-lg text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={section._uploading}
              className="w-full border-2 border-dashed border-white/10 rounded-xl py-6 text-white/25 hover:border-white/25 hover:text-white/50 disabled:opacity-40 transition-colors flex flex-col items-center gap-2"
            >
              {section._uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-widest">Uploading…</span>
                </>
              ) : (
                <>
                  <Upload size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Upload Image</span>
                </>
              )}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) { onImageUpload(file); e.target.value = '' }
            }}
          />
        </SField>

        <SField label="Video (YouTube URL)">
          <input
            type="url"
            value={section.video_url || ''}
            onChange={e => onUpdate('video_url', e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className={inputClass}
          />
          {videoId && (
            <div className="relative rounded-xl overflow-hidden aspect-video bg-[#0a0f1a] border border-white/10 mt-1">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Video preview"
              />
            </div>
          )}
        </SField>
      </div>
    </div>
  )
}

function SField({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-white/40 text-xs font-bold uppercase tracking-widest">{label}</span>
      {children}
    </div>
  )
}

const inputClass =
  'w-full bg-[#0a0f1a] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00436b] transition-colors placeholder:text-white/20'
