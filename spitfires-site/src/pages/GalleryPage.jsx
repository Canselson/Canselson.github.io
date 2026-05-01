import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Images } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TEAMS = {
  'a-team': 'A Team',
  'b-team': 'B Team',
  'c-team': 'C Team',
  'd-team': 'D Team',
  'womens': "Women's",
}

export default function GalleryPage() {
  const [albums,  setAlbums]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('media_albums')
      .select('id, title, date, team, cover_url, media_photos(id)')
      .order('date', { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        setAlbums(data || [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="pt-24 pb-24 max-w-6xl mx-auto px-4">
      <div className="mb-10">
        <p className="text-[#641e31] text-xs font-black uppercase tracking-[0.3em] mb-2">
          Southampton Spitfires
        </p>
        <h1 className="text-white text-4xl sm:text-5xl font-black uppercase tracking-tight">Gallery</h1>
        <p className="text-white/40 mt-3 text-sm">
          Photos from games and events across all teams.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="aspect-[4/3] bg-[#111827] border border-white/10 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : albums.length === 0 ? (
        <div className="text-center py-24 text-white/20 text-sm uppercase tracking-widest">
          No albums yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map(album => <AlbumCard key={album.id} album={album} />)}
        </div>
      )}
    </div>
  )
}

function AlbumCard({ album }) {
  const count = album.media_photos?.length ?? 0
  const team  = album.team ? (TEAMS[album.team] ?? album.team) : null
  const date  = album.date
    ? new Date(album.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <Link
      to={`/gallery/${album.id}`}
      className="group relative rounded-xl overflow-hidden aspect-[4/3] bg-[#111827] border border-white/10 hover:border-white/30 transition-all block"
    >
      {album.cover_url ? (
        <img
          src={album.cover_url}
          alt={album.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Images size={36} className="text-white/10" />
        </div>
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)' }}
      />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-black text-lg leading-tight">{album.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {team && (
            <span className="text-white/55 text-xs font-bold uppercase tracking-widest">{team}</span>
          )}
          {team && date && <span className="text-white/25 text-xs">·</span>}
          {date && <span className="text-white/35 text-xs">{date}</span>}
          <span className="text-white/25 text-xs ml-auto">
            {count} photo{count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </Link>
  )
}
