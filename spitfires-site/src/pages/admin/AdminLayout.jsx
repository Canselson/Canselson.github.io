import { Link, NavLink, Outlet, Navigate } from 'react-router-dom'
import { CalendarDays, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/admin',          label: 'Calendar', icon: CalendarDays },
  // More sections added here as they're built
]

export default function AdminLayout() {
  const { session } = useAuth()

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/admin/login" replace />

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <AdminNav email={session.user.email} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function AdminNav({ email }) {
  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <header className="bg-[#0d1420] border-b border-white/10 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-6">
        {/* Left: logo + admin label + nav */}
        <div className="flex items-center gap-5">
          <Link to="/" className="shrink-0">
            <img src="/logo.png" alt="Spitfires" className="h-8 w-auto" />
          </Link>
          <span className="text-white/20 text-sm hidden sm:block">|</span>
          <span className="text-white/40 text-xs font-black uppercase tracking-widest hidden sm:block">
            Admin
          </span>
          <nav className="flex gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                    isActive
                      ? 'bg-[#00436b] text-white'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon size={13} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: email + sign out */}
        <div className="flex items-center gap-4">
          <span className="text-white/30 text-xs hidden sm:block truncate max-w-[180px]">{email}</span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <LogOut size={13} />
            <span className="hidden sm:block">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
