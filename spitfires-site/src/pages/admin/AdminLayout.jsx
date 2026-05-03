import { useState, useEffect } from 'react'
import { Link, NavLink, Outlet, Navigate } from 'react-router-dom'
import { CalendarDays, Images, MessageSquare, LogOut, KeyRound, FolderOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/admin',          label: 'Calendar', icon: CalendarDays,  end: true  },
  { to: '/admin/gallery',  label: 'Gallery',  icon: Images,        end: false },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquare, end: false },
  { to: '/admin/files',    label: 'Files',    icon: FolderOpen,    end: false },
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

  if (session.user.user_metadata?.must_change_password) {
    return <ForcePasswordChange />
  }

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
  const [unreadCount,       setUnreadCount]       = useState(0)
  const [showChangePassword, setShowChangePassword] = useState(false)

  useEffect(() => {
    async function fetchUnread() {
      const { count } = await supabase
        .from('contact_messages')
        .select('*', { count: 'exact', head: true })
        .eq('read', false)
      setUnreadCount(count ?? 0)
    }
    fetchUnread()

    const channel = supabase
      .channel('unread-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, fetchUnread)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <>
      <header className="bg-[#0d1420] border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Left: logo + admin label + nav */}
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="shrink-0">
              <img src="/logo.png" alt="Spitfires" className="h-8 w-auto" />
            </Link>
            <span className="text-white/20 text-sm hidden sm:block shrink-0">|</span>
            <span className="text-white/40 text-xs font-black uppercase tracking-widest hidden sm:block shrink-0">
              Admin
            </span>
            <nav className="flex gap-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                      isActive
                        ? 'bg-[#00436b] text-white'
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <Icon size={13} />
                  <span className="hidden sm:block">{label}</span>
                  {label === 'Messages' && unreadCount > 0 && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#641e31] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#641e31]" />
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right: email + change password + sign out */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-white/30 text-xs hidden lg:block truncate max-w-[160px]">{email}</span>
            <button
              onClick={() => setShowChangePassword(true)}
              title="Change password"
              className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest p-2"
            >
              <KeyRound size={13} />
            </button>
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

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </>
  )
}

// ─── Forced password change (first login) ────────────────────────────────────

function ForcePasswordChange() {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })
    if (error) { setError(error.message); setLoading(false) }
    // On success, AuthContext receives USER_UPDATED and re-renders AdminLayout normally
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="Spitfires" className="h-16 w-auto" />
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-2xl p-8">
          <h1 className="text-white text-xl font-black uppercase tracking-widest mb-1">Set Your Password</h1>
          <p className="text-white/40 text-xs mb-8">
            Choose a password before continuing to the admin panel.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-white/50 text-xs font-bold uppercase tracking-widest">New Password</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                required className={inputClass} placeholder="••••••••" autoFocus />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Confirm Password</span>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                required className={inputClass} placeholder="••••••••" />
            </label>
            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</p>
            )}
            <button type="submit" disabled={loading}
              className="mt-2 bg-[#00436b] hover:bg-[#005a8f] disabled:opacity-50 text-white font-bold uppercase tracking-widest text-sm py-3 rounded-lg transition-colors">
              {loading ? 'Saving…' : 'Set Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Change password modal ────────────────────────────────────────────────────

function ChangePasswordModal({ onClose }) {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [done,     setDone]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false) }
    else setDone(true)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[380px] bg-[#111827] border border-white/10 rounded-2xl p-6">
        {done ? (
          <div className="text-center py-4">
            <p className="text-white font-bold mb-2">Password updated</p>
            <p className="text-white/50 text-sm mb-6">Your password has been changed successfully.</p>
            <button onClick={onClose}
              className="text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="text-white font-bold mb-1">Change Password</p>
            <p className="text-white/40 text-xs mb-5">Enter a new password for your account.</p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-white/50 text-xs font-bold uppercase tracking-widest">New Password</span>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  className={inputClass} placeholder="••••••••" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Confirm Password</span>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                  className={inputClass} placeholder="••••••••" />
              </label>
              {error && (
                <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</p>
              )}
              <div className="flex gap-3 mt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white/50 bg-white/5 hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white bg-[#00436b] hover:bg-[#005a8f] disabled:opacity-50 transition-colors">
                  {loading ? 'Updating…' : 'Update'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  )
}

const inputClass =
  'bg-[#0a0f1a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00436b] transition-colors'
