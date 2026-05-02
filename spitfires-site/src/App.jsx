import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useParams, Outlet } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { AuthProvider } from './context/AuthContext'
import { supabase } from './lib/supabase'
import CalendarPage from './pages/CalendarPage'
import FixturesPage from './pages/FixturesPage'
import MatchReportPage from './pages/MatchReportPage'
import GalleryPage from './pages/GalleryPage'
import AlbumPage from './pages/AlbumPage'
import AboutPage from './pages/AboutPage'
import JoinPage from './pages/JoinPage'
import LoginPage from './pages/admin/LoginPage'
import AdminLayout from './pages/admin/AdminLayout'
import CalendarAdmin from './pages/admin/CalendarAdmin'
import ReportAdmin from './pages/admin/ReportAdmin'
import GalleryAdmin from './pages/admin/GalleryAdmin'
import MessagesAdmin from './pages/admin/MessagesAdmin'
import './App.css'

// ─── Data ────────────────────────────────────────────────────────────────────

const teams = [
  { name: 'A Team',   slug: 'a-team',  img: '/team_photos/A-Team.jpg' },
  { name: 'B Team',   slug: 'b-team',  img: '/team_photos/B-Team.jpg' },
  { name: 'C Team',   slug: 'c-team',  img: '/team_photos/C-Team.jpg' },
  { name: 'D Team',   slug: 'd-team',  img: '/team_photos/D-Team.jpg' },
  { name: "Women's",  slug: 'womens',  img: '/team_photos/Womens.jpg' },
]

const TEAM_NAMES = {
  'a-team': 'A Team',
  'b-team': 'B Team',
  'c-team': 'C Team',
  'd-team': 'D Team',
  'womens': "Women's",
}

// ─── App / Router ─────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"                  element={<HomePage />} />
          <Route path="/calendar"            element={<CalendarPage />} />
          <Route path="/fixtures"            element={<FixturesPage />} />
          <Route path="/report/:eventId"     element={<MatchReportPage />} />
          <Route path="/gallery"             element={<GalleryPage />} />
          <Route path="/gallery/:albumId"    element={<AlbumPage />} />
          <Route path="/about"               element={<AboutPage />} />
          <Route path="/join"                element={<JoinPage />} />
          <Route path="/teams/:teamSlug"     element={<TeamPage />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<CalendarAdmin />} />
          <Route path="reports/:eventId" element={<ReportAdmin />} />
          <Route path="gallery" element={<GalleryAdmin />} />
          <Route path="gallery/:albumId" element={<GalleryAdmin />} />
          <Route path="messages" element={<MessagesAdmin />} />
        </Route>
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

function Layout() {
  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white font-sans">
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1a]/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="Spitfires" className="h-10 w-auto" />
          <span className="font-bold text-lg tracking-widest uppercase text-white hidden sm:block">
            Southampton Spitfires
          </span>
        </Link>

        <nav className="flex items-center gap-7 text-xs font-semibold tracking-widest uppercase text-white/60">
          {/* Teams dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1 uppercase hover:text-white transition-colors py-1">
              Teams <ChevronDown size={12} className="mt-0.5" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-[#111827] border border-white/10 rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 min-w-[140px] shadow-2xl">
              {teams.map(t => (
                <Link
                  key={t.slug}
                  to={`/teams/${t.slug}`}
                  className="block px-5 py-3 text-xs tracking-widest hover:bg-white/10 hover:text-white transition-colors border-b border-white/5 last:border-0"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          </div>

          <Link to="/calendar" className="hover:text-white transition-colors">Calendar</Link>
          <Link to="/fixtures" className="hover:text-white transition-colors">Fixtures</Link>
          <Link to="/gallery" className="hover:text-white transition-colors">Gallery</Link>
          <Link to="/about" className="hover:text-white transition-colors">About</Link>
          <Link
            to="/join"
            className="bg-[#641e31] text-white px-4 py-2 rounded text-xs tracking-widest uppercase font-bold hover:bg-[#7a2540] transition-colors"
          >
            Join Us
          </Link>
        </nav>
      </div>
    </header>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage() {
  const [homeData, setHomeData] = useState(null)

  useEffect(() => {
    const now = new Date().toISOString()
    Promise.all([
      supabase.from('events')
        .select('id, opponent, home_away, team, starts_at, match_reports(id, home_score, away_score)')
        .eq('type', 'game').lt('starts_at', now)
        .order('starts_at', { ascending: false }).limit(3),
      supabase.from('events')
        .select('id, opponent, home_away, team, starts_at, location')
        .eq('type', 'game').gte('starts_at', now)
        .order('starts_at', { ascending: true }).limit(3),
      supabase.from('events')
        .select('id, title, starts_at, location')
        .eq('type', 'social').gte('starts_at', now)
        .order('starts_at', { ascending: true }).limit(1),
      supabase.from('media_photos')
        .select('id, url, caption, album_id')
        .order('created_at', { ascending: false }).limit(24),
    ]).then(([{ data: recent }, { data: upcoming }, { data: socials }, { data: photos }]) => {
      const shuffled = (photos || []).sort(() => Math.random() - 0.5).slice(0, 4)
      setHomeData({
        recentGames:   recent   || [],
        upcomingGames: upcoming || [],
        nextSocial:    socials?.[0] ?? null,
        galleryPhotos: shuffled,
      })
    })
  }, [])

  return (
    <>
      <Hero />
      <InfoStrip data={homeData} />
      <TeamsSection />
      <MatchGallery photos={homeData?.galleryPhotos} />
    </>
  )
}

function Hero() {
  return (
    <section className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
      <img
        src="/team_photos/A-Team.jpg"
        alt="Southampton Spitfires"
        className="absolute inset-0 w-full h-full object-cover object-top scale-105"
        style={{ filter: 'blur(1px)' }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,67,107,0.55) 0%, rgba(10,15,26,0.85) 60%, #0a0f1a 100%)',
        }}
      />
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <img src="/logo.png" alt="" className="h-28 w-auto mx-auto mb-6 drop-shadow-2xl" />
        <h1
          className="text-5xl sm:text-7xl font-black tracking-tight uppercase leading-none mb-4"
          style={{ textShadow: '0 4px 32px rgba(0,0,0,0.6)' }}
        >
          Southampton<br />
          <span style={{ color: '#c0e8f8' }}>Spitfires</span>
        </h1>
        <p className="text-white/70 text-lg sm:text-xl mb-10 tracking-wide">
          Southampton University Ice Hockey Club
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            to="/fixtures"
            className="bg-[#00436b] hover:bg-[#005a8f] text-white font-bold px-8 py-3 rounded-sm uppercase tracking-widest text-sm transition-colors"
          >
            View Fixtures
          </Link>
          <Link
            to="/about"
            className="bg-[#641e31] hover:bg-[#7a2540] text-white font-bold px-8 py-3 rounded-sm uppercase tracking-widest text-sm transition-colors"
          >
            About Us
          </Link>
        </div>

        {/* Social / external links */}
        <div className="flex items-center justify-center gap-4 mt-8">
          {[
            { href: 'https://www.instagram.com/southamptonspitfires/', src: '/Instagram_logo_2016.svg.png', alt: 'Instagram' },
            { href: 'https://buiha.org/club/southampton',              src: '/buiha_logo.png',              alt: 'BUIHA'     },
            { href: 'https://myspitfires.club/',                       src: '/logo.png',                    alt: 'My Spitfires' },
            { href: 'https://www.youtube.com/@southamptonspitfires',   src: '/youtube-logo.png',            alt: 'YouTube'   },
          ].map(({ href, src, alt }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={alt}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 transition-colors flex items-center justify-center overflow-hidden p-1.5"
            >
              <img src={src} alt={alt} className="w-full h-full object-contain" />
            </a>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0a0f1a] to-transparent" />
    </section>
  )
}

function InfoStrip({ data }) {
  return (
    <section className="max-w-7xl mx-auto px-4 pb-16 grid gap-6 md:grid-cols-3">
      <InfoCard title="Recent Results">
        <RecentResults games={data?.recentGames} loading={data === null} />
      </InfoCard>
      <InfoCard title="Upcoming Fixtures">
        <UpcomingFixtures games={data?.upcomingGames} loading={data === null} />
      </InfoCard>
      <InfoCard title="Next Social">
        <NextSocial social={data?.nextSocial} loading={data === null} />
      </InfoCard>
    </section>
  )
}

function RecentResults({ games, loading }) {
  if (loading) return <LoadingRows />
  if (!games?.length) return <EmptyState>No results yet.</EmptyState>
  return games.map(game => {
    const report  = game.match_reports?.[0]
    const isHome  = game.home_away === 'home'
    const ourScore = report ? (isHome ? report.home_score : report.away_score) : null
    const theirScore = report ? (isHome ? report.away_score : report.home_score) : null
    const hasScore = ourScore !== null && theirScore !== null
    const win  = hasScore && ourScore > theirScore
    const draw = hasScore && ourScore === theirScore
    const badge   = !hasScore ? '?' : draw ? 'D' : win ? 'W' : 'L'
    const badgeBg = !hasScore ? '#374151' : draw ? '#374151' : win ? '#14532d' : '#7f1d1d'
    const date = new Date(game.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const row = (
      <div key={game.id} className="flex items-center gap-3 py-3 border-b border-white/10 last:border-0">
        <span className="w-7 h-7 rounded text-xs font-black flex items-center justify-center shrink-0" style={{ backgroundColor: badgeBg }}>
          {badge}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">vs {game.opponent}</p>
          <p className="text-white/40 text-xs">{TEAM_NAMES[game.team] ?? game.team} · {date}</p>
        </div>
        {hasScore ? (
          <span className="text-white font-bold text-sm tabular-nums shrink-0">
            {report.home_score}–{report.away_score}
          </span>
        ) : (
          <span className="text-white/20 text-xs shrink-0">TBD</span>
        )}
      </div>
    )
    return report ? <Link key={game.id} to={`/report/${game.id}`} className="block hover:bg-white/5 -mx-5 px-5 rounded transition-colors">{row}</Link> : row
  })
}

function UpcomingFixtures({ games, loading }) {
  if (loading) return <LoadingRows />
  if (!games?.length) return <EmptyState>No upcoming fixtures.</EmptyState>
  return games.map(game => {
    const date   = new Date(game.starts_at)
    const isHome = game.home_away === 'home'
    return (
      <Link key={game.id} to="/fixtures" className="flex items-center gap-3 py-3 border-b border-white/10 last:border-0 hover:bg-white/5 -mx-5 px-5 rounded transition-colors">
        <div className="w-7 h-7 rounded text-xs font-black flex items-center justify-center shrink-0" style={{ backgroundColor: isHome ? '#003a5c' : '#4a1525' }}>
          {isHome ? 'H' : 'A'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">vs {game.opponent}</p>
          <p className="text-white/40 text-xs">
            {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            {' · '}
            {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {game.team && (
          <span className="text-white/25 text-xs shrink-0">{TEAM_NAMES[game.team] ?? game.team}</span>
        )}
      </Link>
    )
  })
}

function NextSocial({ social, loading }) {
  if (loading) return <div className="h-24 bg-white/5 rounded-lg animate-pulse my-4" />
  if (!social) return <EmptyState>No upcoming socials.</EmptyState>
  const date = new Date(social.starts_at)
  return (
    <div className="py-4 space-y-3">
      <p className="text-white font-bold text-xl leading-snug">{social.title}</p>
      <div className="space-y-1">
        <p className="text-white/50 text-sm">
          {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          {' · '}
          {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
        {social.location && <p className="text-white/50 text-sm">{social.location}</p>}
      </div>
      <Link to="/calendar" className="inline-block mt-2 text-xs font-bold uppercase tracking-widest text-[#c0e8f8] hover:text-white transition-colors">
        View Calendar →
      </Link>
    </div>
  )
}

function LoadingRows() {
  return (
    <div className="py-2 flex flex-col gap-2">
      {[1, 2, 3].map(i => <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />)}
    </div>
  )
}

function EmptyState({ children }) {
  return <p className="text-white/20 text-xs py-4 uppercase tracking-wider">{children}</p>
}

function InfoCard({ title, children }) {
  return (
    <div className="bg-[#111827] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
        <div className="w-1 h-4 bg-[#641e31] rounded-full" />
        <h2 className="text-xs font-black uppercase tracking-widest text-white/80">{title}</h2>
      </div>
      <div className="px-5">{children}</div>
    </div>
  )
}

function TeamsSection() {
  return (
    <section className="max-w-7xl mx-auto px-4 pb-20">
      <SectionHeading>Our Teams</SectionHeading>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {teams.map((t) => (
          <Link
            key={t.slug}
            to={`/teams/${t.slug}`}
            className="relative rounded-xl overflow-hidden aspect-[16/9] group block"
          >
            <img
              src={t.img}
              alt={t.name}
              className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,15,30,0.85) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)',
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
              <p className="text-white font-black text-xl uppercase tracking-widest">{t.name}</p>
              <span className="text-white/50 text-xs font-semibold uppercase tracking-widest group-hover:text-white transition-colors">
                View →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function MatchGallery({ photos }) {
  // Hide section if we've loaded and have nothing
  if (photos !== undefined && photos.length === 0) return null

  const items = photos ?? [null, null, null, null]

  return (
    <section className="max-w-7xl mx-auto px-4 pb-20">
      <SectionHeading>On the Ice</SectionHeading>
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((p, i) =>
          p === null ? (
            <div key={i} className="aspect-video bg-[#111827] border border-white/5 rounded-xl animate-pulse" />
          ) : (
            <Link
              key={p.id}
              to={`/gallery/${p.album_id}`}
              className="relative rounded-xl overflow-hidden aspect-video group block"
            >
              <img
                src={p.url}
                alt={p.caption || ''}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }}
              >
                {p.caption && <p className="text-white text-xs font-semibold">{p.caption}</p>}
              </div>
            </Link>
          )
        )}
      </div>
      <div className="mt-5 text-center">
        <Link
          to="/gallery"
          className="text-white/30 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
        >
          View Full Gallery →
        </Link>
      </div>
    </section>
  )
}

// ─── Team Page (placeholder) ──────────────────────────────────────────────────

function TeamPage() {
  const { teamSlug } = useParams()
  const team = teams.find(t => t.slug === teamSlug)

  if (!team) {
    return (
      <div className="pt-32 text-center text-white/50 text-lg">Team not found.</div>
    )
  }

  return (
    <>
      {/* Hero banner */}
      <div className="relative h-80 sm:h-[28rem] overflow-hidden">
        <img
          src={team.img}
          alt={team.name}
          className="w-full h-full object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(10,15,26,0.3) 0%, rgba(10,15,26,0.85) 80%, #0a0f1a 100%)',
          }}
        />
        <div className="absolute bottom-0 left-0 px-8 pb-8 max-w-7xl mx-auto w-full">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Southampton Spitfires</p>
          <h1 className="text-white text-4xl sm:text-5xl font-black uppercase tracking-tight">
            {team.name}
          </h1>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="max-w-7xl mx-auto px-8 py-20 text-center">
        <p className="text-white/30 text-sm uppercase tracking-widest">
          Full team page coming soon — fixtures, results, and roster will appear here.
        </p>
      </div>
    </>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionHeading({ children }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-white/10" />
      <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/50">{children}</h2>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/10 mt-4">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Spitfires" className="h-8 w-auto opacity-60" />
          <span className="text-white/40 text-sm">Southampton Spitfires Ice Hockey Club</span>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-white/30 text-xs">© {new Date().getFullYear()} · Southampton University</p>
          <Link to="/admin" className="text-white/15 hover:text-white/40 text-xs transition-colors">Admin</Link>
        </div>
      </div>
    </footer>
  )
}
