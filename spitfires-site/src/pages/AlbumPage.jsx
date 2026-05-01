import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TEAMS = {
  'a-team': 'A Team',
  'b-team': 'B Team',
  'c-team': 'C Team',
  'd-team': 'D Team',
  'womens': "Women's",
}

export default function AlbumPage() {
  const { albumId } = useParams()
  const [album,         setAlbum]         = useState(null)
  const [photos,        setPhotos]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: al }, { data: ph }] = await Promise.all([
        supabase.from('media_albums').select('*').eq('id', albumId).single(),
        supabase.from('media_photos').select('*').eq('album_id', albumId).order('sort_order').order('created_at'),
      ])
      setAlbum(al)
      setPhotos(ph || [])
      setLoading(false)
    }
    load()
  }, [albumId])

  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  useEffect(() => {
    if (lightboxIndex === null) return
    function handleKey(e) {
      if (e.key === 'Escape')     closeLightbox()
      if (e.key === 'ArrowLeft')  setLightboxIndex(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setLightboxIndex(i => Math.min(photos.length - 1, i + 1))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [lightboxIndex, photos.length, closeLightbox])

  const team = album?.team ? (TEAMS[album.team] ?? album.team) : null
  const date = album?.date
    ? new Date(album.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="pt-24 pb-24 max-w-6xl mx-auto px-4">
      <Link
        to="/gallery"
        className="text-white/30 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors mb-6 inline-block"
      >
        ← Gallery
      </Link>

      {!loading && album && (
        <div className="mb-8">
          <p className="text-[#641e31] text-xs font-black uppercase tracking-[0.3em] mb-2">
            {team ?? 'Southampton Spitfires'}
          </p>
          <h1 className="text-white text-3xl sm:text-4xl font-black uppercase tracking-tight">
            {album.title}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-white/40 text-sm flex-wrap">
            {date && <span>{date}</span>}
            {date && <span>·</span>}
            <span>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
          </div>
          {album.description && (
            <p className="text-white/40 mt-3 text-sm">{album.description}</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square bg-[#111827] border border-white/10 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-24 text-white/20 text-sm uppercase tracking-widest">
          No photos in this album yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              onClick={() => setLightboxIndex(i)}
              className="aspect-square rounded-lg overflow-hidden group relative bg-[#111827] block"
            >
              <img
                src={photo.url}
                alt={photo.caption || ''}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {photo.caption && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <p className="text-white text-xs text-left">{photo.caption}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={() => setLightboxIndex(i => Math.max(0, i - 1))}
          onNext={() => setLightboxIndex(i => Math.min(photos.length - 1, i + 1))}
        />
      )}
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  const photo = photos[index]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/96 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors z-10"
        onClick={onClose}
      >
        <X size={22} />
      </button>

      {/* Counter */}
      <span className="absolute top-5 left-1/2 -translate-x-1/2 text-white/35 text-xs font-bold uppercase tracking-widest pointer-events-none">
        {index + 1} / {photos.length}
      </span>

      {/* Prev */}
      {index > 0 && (
        <button
          className="absolute left-2 sm:left-5 p-2 text-white/40 hover:text-white transition-colors z-10"
          onClick={e => { e.stopPropagation(); onPrev() }}
        >
          <ChevronLeft size={40} />
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-5xl max-h-[85vh] w-full h-full flex items-center justify-center px-16 py-14"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={photo.url}
          alt={photo.caption || ''}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Next */}
      {index < photos.length - 1 && (
        <button
          className="absolute right-2 sm:right-5 p-2 text-white/40 hover:text-white transition-colors z-10"
          onClick={e => { e.stopPropagation(); onNext() }}
        >
          <ChevronRight size={40} />
        </button>
      )}

      {photo.caption && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/55 text-sm text-center max-w-lg px-4 pointer-events-none">
          {photo.caption}
        </p>
      )}
    </div>
  )
}
