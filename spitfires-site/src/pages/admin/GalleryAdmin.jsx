import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, X, AlertTriangle, Upload, Star, Images } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const TEAMS = [
  { slug: 'a-team', name: 'A Team'  },
  { slug: 'b-team', name: 'B Team'  },
  { slug: 'c-team', name: 'C Team'  },
  { slug: 'd-team', name: 'D Team'  },
  { slug: 'womens', name: "Women's" },
]

const TEAM_NAMES = Object.fromEntries(TEAMS.map(t => [t.slug, t.name]))

const EMPTY_ALBUM = { title: '', date: '', team: '', description: '' }

export default function GalleryAdmin() {
  const { albumId } = useParams()
  return albumId ? <AlbumEditor albumId={albumId} /> : <AlbumList />
}

// ─── Album list ───────────────────────────────────────────────────────────────

function AlbumList() {
  const navigate = useNavigate()
  const [albums,      setAlbums]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [panelAlbum,  setPanelAlbum]  = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('media_albums')
      .select('id, title, date, team, cover_url, media_photos(id)')
      .order('date', { ascending: false, nullsFirst: false })
    setAlbums(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteAlbum(album) {
    await supabase.from('media_albums').delete().eq('id', album.id)
    setDeleteTarget(null)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white text-2xl font-black uppercase tracking-tight">Gallery</h1>
          <p className="text-white/40 text-sm mt-1">Manage photo albums</p>
        </div>
        <button
          onClick={() => setPanelAlbum(EMPTY_ALBUM)}
          className="flex items-center gap-2 bg-[#00436b] hover:bg-[#005a8f] text-white text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={14} /> New Album
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-[#111827] border border-white/10 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : albums.length === 0 ? (
        <p className="text-white/20 text-sm py-4">No albums yet — create one above.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {albums.map(album => (
            <AlbumRow
              key={album.id}
              album={album}
              onEdit={() => setPanelAlbum(albumToForm(album))}
              onDelete={() => setDeleteTarget(album)}
              onOpen={() => navigate(`/admin/gallery/${album.id}`)}
            />
          ))}
        </div>
      )}

      {panelAlbum !== null && (
        <AlbumFormPanel
          initial={panelAlbum}
          onClose={() => setPanelAlbum(null)}
          onSaved={() => { setPanelAlbum(null); load() }}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          message={`"${deleteTarget.title}" and all its photos will be permanently deleted.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteAlbum(deleteTarget)}
        />
      )}
    </div>
  )
}

function AlbumRow({ album, onEdit, onDelete, onOpen }) {
  const count = album.media_photos?.length ?? 0
  const team  = album.team ? (TEAM_NAMES[album.team] ?? album.team) : null
  const date  = album.date
    ? new Date(album.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="flex items-center gap-4 bg-[#111827] border border-white/10 rounded-xl px-4 py-3">
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-[#0d1520] border border-white/10 flex items-center justify-center">
        {album.cover_url
          ? <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
          : <Images size={18} className="text-white/15" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{album.title}</p>
        <p className="text-white/35 text-xs mt-0.5">
          {[team, date, `${count} photo${count !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-1 shrink-0">
        <button
          onClick={onOpen}
          className="px-3 py-2 rounded-lg text-white/40 hover:text-[#7ec8e3] hover:bg-[#00436b]/20 text-xs font-bold uppercase tracking-widest transition-colors"
        >
          Open
        </button>
        <button
          onClick={onEdit}
          className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Album editor (photo management) ─────────────────────────────────────────

function AlbumEditor({ albumId }) {
  const navigate = useNavigate()
  const [album,        setAlbum]        = useState(null)
  const [photos,       setPhotos]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [uploading,    setUploading]    = useState(false)
  const [progress,     setProgress]     = useState({ done: 0, total: 0 })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const fileRef = useRef()

  const loadPhotos = useCallback(async () => {
    const { data } = await supabase
      .from('media_photos')
      .select('*')
      .eq('album_id', albumId)
      .order('sort_order')
      .order('created_at')
    setPhotos(data || [])
  }, [albumId])

  useEffect(() => {
    async function load() {
      const { data: al } = await supabase.from('media_albums').select('*').eq('id', albumId).single()
      setAlbum(al)
      await loadPhotos()
      setLoading(false)
    }
    load()
  }, [albumId, loadPhotos])

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''
    setUploading(true)
    setProgress({ done: 0, total: files.length })

    const base = photos.length
    let firstUrl = null

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${albumId}/${crypto.randomUUID()}.${ext}`

      const { data: upload, error } = await supabase.storage.from('media').upload(path, file)
      if (error) {
        console.error('Upload error:', error)
        setProgress(p => ({ ...p, done: p.done + 1 }))
        continue
      }

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(upload.path)
      if (i === 0) firstUrl = publicUrl

      await supabase.from('media_photos').insert({
        album_id:   albumId,
        url:        publicUrl,
        sort_order: base + i,
      })

      setProgress(p => ({ ...p, done: p.done + 1 }))
    }

    // Auto-set cover if the album has none
    if (firstUrl && album && !album.cover_url) {
      await supabase.from('media_albums').update({ cover_url: firstUrl }).eq('id', albumId)
      setAlbum(a => ({ ...a, cover_url: firstUrl }))
    }

    await loadPhotos()
    setUploading(false)
  }

  async function handleSetCover(url) {
    await supabase.from('media_albums').update({ cover_url: url }).eq('id', albumId)
    setAlbum(a => ({ ...a, cover_url: url }))
  }

  async function handleDeletePhoto(photo) {
    const segment = photo.url.split('/storage/v1/object/public/media/')[1]
    if (segment) await supabase.storage.from('media').remove([segment])
    await supabase.from('media_photos').delete().eq('id', photo.id)

    // If this was the cover, auto-pick the next remaining photo
    if (album.cover_url === photo.url) {
      const remaining = photos.filter(p => p.id !== photo.id)
      const newCover  = remaining[0]?.url ?? null
      await supabase.from('media_albums').update({ cover_url: newCover }).eq('id', albumId)
      setAlbum(a => ({ ...a, cover_url: newCover }))
    }

    setDeleteTarget(null)
    await loadPhotos()
  }

  if (loading) return <div className="text-white/40 text-sm animate-pulse">Loading…</div>
  if (!album)  return <div className="text-red-400 text-sm">Album not found.</div>

  return (
    <div>
      <button
        onClick={() => navigate('/admin/gallery')}
        className="text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors mb-6 inline-block"
      >
        ← Gallery
      </button>

      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-white text-2xl font-black uppercase tracking-tight">{album.title}</h1>
          <p className="text-white/40 text-sm mt-1">
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
            {album.date && ` · ${new Date(album.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 bg-[#00436b] hover:bg-[#005a8f] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition-colors"
        >
          <Upload size={14} />
          {uploading ? `Uploading ${progress.done} / ${progress.total}…` : 'Add Photos'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>

      <p className="text-white/25 text-xs uppercase tracking-widest mb-4">
        Hover a photo — <Star size={9} className="inline" /> sets the album cover, <Trash2 size={9} className="inline" /> deletes it.
      </p>

      {photos.length === 0 && !uploading ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-white/10 rounded-xl py-16 text-white/25 hover:border-white/25 hover:text-white/50 transition-colors flex flex-col items-center gap-2"
        >
          <Upload size={24} />
          <span className="text-xs font-bold uppercase tracking-widest">Upload photos</span>
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden bg-[#111827]">
              <img src={photo.url} alt="" className="w-full h-full object-cover" />

              {album.cover_url === photo.url && (
                <div className="absolute top-1.5 left-1.5 bg-[#641e31] rounded px-1.5 py-0.5 flex items-center gap-1">
                  <Star size={9} className="text-white fill-white" />
                  <span className="text-white text-xs font-bold uppercase tracking-wider">Cover</span>
                </div>
              )}

              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {album.cover_url !== photo.url && (
                  <button
                    onClick={() => handleSetCover(photo.url)}
                    title="Set as cover"
                    className="p-2 bg-white/15 hover:bg-white/25 rounded-lg transition-colors"
                  >
                    <Star size={15} className="text-white" />
                  </button>
                )}
                <button
                  onClick={() => setDeleteTarget(photo)}
                  className="p-2 bg-red-600/80 hover:bg-red-600 rounded-lg transition-colors"
                >
                  <Trash2 size={15} className="text-white" />
                </button>
              </div>
            </div>
          ))}

          {uploading && Array.from({ length: progress.total - progress.done }).map((_, i) => (
            <div key={`ph-${i}`} className="aspect-square rounded-lg bg-[#111827] border border-white/10 animate-pulse" />
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteModal
          message="This photo will be permanently deleted."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDeletePhoto(deleteTarget)}
        />
      )}
    </div>
  )
}

// ─── Album form panel ─────────────────────────────────────────────────────────

function AlbumFormPanel({ initial, onClose, onSaved }) {
  const isNew = !initial.id
  const [form,   setForm]   = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required.'); return }
    setSaving(true)
    const payload = {
      title:       form.title.trim(),
      date:        form.date || null,
      team:        form.team || null,
      description: form.description.trim() || null,
    }
    const { error: err } = isNew
      ? await supabase.from('media_albums').insert(payload)
      : await supabase.from('media_albums').update(payload).eq('id', initial.id)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-[#111827] border-l border-white/10 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-white font-black uppercase tracking-widest text-sm">
            {isNew ? 'New Album' : 'Edit Album'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
          <Field label="Title *">
            <input
              type="text"
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. A Team vs Bristol — 19 Apr 2025"
              className={inputClass}
              autoFocus
            />
          </Field>

          <Field label="Date">
            <input type="date" value={form.date} onChange={set('date')} className={inputClass} />
          </Field>

          <Field label="Team">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, team: '' }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  !form.team ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                }`}
              >
                All Teams
              </button>
              {TEAMS.map(t => (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, team: t.slug }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    form.team === t.slug ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={3}
              placeholder="Optional description"
              className={`${inputClass} resize-none`}
            />
          </Field>

          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

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
              {saving ? 'Saving…' : isNew ? 'Create Album' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

function DeleteModal({ message, onCancel, onConfirm }) {
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
            <p className="text-white font-bold mb-1">Are you sure?</p>
            <p className="text-white/50 text-sm">{message}</p>
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function albumToForm(album) {
  return {
    id:          album.id,
    title:       album.title       ?? '',
    date:        album.date        ?? '',
    team:        album.team        ?? '',
    description: album.description ?? '',
  }
}
