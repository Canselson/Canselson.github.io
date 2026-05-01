import { BrowserRouter, Routes, Route, Link, useParams, Outlet } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { AuthProvider } from './context/AuthContext'
import CalendarPage from './pages/CalendarPage'
import FixturesPage from './pages/FixturesPage'
import MatchReportPage from './pages/MatchReportPage'
import LoginPage from './pages/admin/LoginPage'
import AdminLayout from './pages/admin/AdminLayout'
import CalendarAdmin from './pages/admin/CalendarAdmin'
import ReportAdmin from './pages/admin/ReportAdmin'
import './App.css'

// ─── Data ────────────────────────────────────────────────────────────────────

const teams = [
  { name: 'A Team',   slug: 'a-team',  img: '/team_photos/A-Team.jpg' },
  { name: 'B Team',   slug: 'b-team',  img: '/team_photos/B-Team.jpg' },
  { name: 'C Team',   slug: 'c-team',  img: '/team_photos/C-Team.jpg' },
  { name: 'D Team',   slug: 'd-team',  img: '/team_photos/D-Team.jpg' },
  { name: "Women's",  slug: 'womens',  img: '/team_photos/Womens.jpg' },
]

const recentResults = [
  { date: '26 Apr', home: 'Southampton', homeScore: 4, away: 'Exeter',      awayScore: 2 },
  { date: '19 Apr', home: 'Bristol',     homeScore: 1, away: 'Southampton', awayScore: 5 },
  { date: '12 Apr', home: 'Southampton', homeScore: 3, away: 'Bath',        awayScore: 3 },
]

const upcomingGames = [
  { date: 'Sat 10 May', time: '19:30', opponent: 'Cardiff', venue: 'Home' },
  { date: 'Sat 17 May', time: '20:00', opponent: 'Bristol', venue: 'Away' },
  { date: 'Sat 24 May', time: '19:00', opponent: 'Exeter',  venue: 'Home' },
]

const nextSocial = {
  title:    'End of Season Banquet',
  date:     'Fri 16 May',
  time:     '7:00 PM',
  location: 'The Talking Heads, Southampton',
}

const matchPhotos = [
  { src: '/team_photos/B vs Cambridge  22-11-25.jpeg',            label: 'B vs Cambridge'       },
  { src: '/team_photos/C vs Cov 24-01-26.jpg',                    label: 'C vs Coventry'         },
  { src: '/team_photos/D vs Birmingham D 28-03-26.jpeg',          label: 'D vs Birmingham'       },
  { src: '/team_photos/Womens vs Birmingham Womens 22-02-26.jpeg', label: "Women's vs Birmingham" },
]

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
          <Route path="/teams/:teamSlug"     element={<TeamPage />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<CalendarAdmin />} />
          <Route path="reports/:eventId" element={<ReportAdmin />} />
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
          <a href="#" className="hover:text-white transition-colors">Gallery</a>
          <a href="#" className="hover:text-white transition-colors">Committee</a>
          <a
            href="#"
            className="bg-[#641e31] text-white px-4 py-2 rounded text-xs tracking-widest uppercase font-bold hover:bg-[#7a2540] transition-colors"
          >
            Join Us
          </a>
        </nav>
      </div>
    </header>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage() {
  return (
    <>
      <Hero />
      <InfoStrip />
      <TeamsSection />
      <MatchGallery />
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
          <a
            href="#"
            className="bg-[#00436b] hover:bg-[#005a8f] text-white font-bold px-8 py-3 rounded-sm uppercase tracking-widest text-sm transition-colors"
          >
            View Fixtures
          </a>
          <a
            href="#"
            className="bg-[#641e31] hover:bg-[#7a2540] text-white font-bold px-8 py-3 rounded-sm uppercase tracking-widest text-sm transition-colors"
          >
            Join the Club
          </a>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0a0f1a] to-transparent" />
    </section>
  )
}

function InfoStrip() {
  return (
    <section className="max-w-7xl mx-auto px-4 pb-16 grid gap-6 md:grid-cols-3">
      <InfoCard title="Recent Results">
        {recentResults.map((r, i) => {
          const sotonHome = r.home === 'Southampton'
          const sotonScore = sotonHome ? r.homeScore : r.awayScore
          const oppScore   = sotonHome ? r.awayScore : r.homeScore
          const opponent   = sotonHome ? r.away : r.home
          const win  = sotonScore > oppScore
          const draw = sotonScore === oppScore
          const badge    = draw ? 'D' : win ? 'W' : 'L'
          const badgeBg  = draw ? '#374151' : win ? '#14532d' : '#7f1d1d'
          return (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-white/10 last:border-0">
              <span
                className="w-7 h-7 rounded text-xs font-black flex items-center justify-center shrink-0"
                style={{ backgroundColor: badgeBg }}
              >
                {badge}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">vs {opponent}</p>
                <p className="text-white/40 text-xs">{r.date}</p>
              </div>
              <span className="text-white font-bold text-sm tabular-nums">
                {r.homeScore}–{r.awayScore}
              </span>
            </div>
          )
        })}
      </InfoCard>

      <InfoCard title="Upcoming Fixtures">
        {upcomingGames.map((g, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-white/10 last:border-0">
            <div
              className="w-7 h-7 rounded text-xs font-black flex items-center justify-center shrink-0"
              style={{ backgroundColor: g.venue === 'Home' ? '#003a5c' : '#4a1525' }}
            >
              {g.venue === 'Home' ? 'H' : 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">vs {g.opponent}</p>
              <p className="text-white/40 text-xs">{g.date} · {g.time}</p>
            </div>
          </div>
        ))}
      </InfoCard>

      <InfoCard title="Next Social">
        <div className="py-4 space-y-3">
          <p className="text-white font-bold text-xl leading-snug">{nextSocial.title}</p>
          <div className="space-y-1">
            <p className="text-white/50 text-sm">{nextSocial.date} · {nextSocial.time}</p>
            <p className="text-white/50 text-sm">{nextSocial.location}</p>
          </div>
          <a href="#" className="inline-block mt-2 text-xs font-bold uppercase tracking-widest text-[#c0e8f8] hover:text-white transition-colors">
            More Info →
          </a>
        </div>
      </InfoCard>
    </section>
  )
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

function MatchGallery() {
  return (
    <section className="max-w-7xl mx-auto px-4 pb-20">
      <SectionHeading>On the Ice</SectionHeading>
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        {matchPhotos.map((p) => (
          <div key={p.src} className="relative rounded-xl overflow-hidden aspect-video group cursor-pointer">
            <img
              src={p.src}
              alt={p.label}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }}
            >
              <p className="text-white text-xs font-semibold">{p.label}</p>
            </div>
          </div>
        ))}
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
