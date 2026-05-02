import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const { session } = useAuth()
  const navigate    = useNavigate()
  const [view, setView] = useState('login') // 'login' | 'forgot' | 'recovery'

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setView('recovery')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session && view !== 'recovery') return <Navigate to="/admin" replace />

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/logo.png" alt="Spitfires" className="h-16 w-auto" />
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-2xl p-8">
          {view === 'login'    && <LoginForm    onForgot={() => setView('forgot')} />}
          {view === 'forgot'   && <ForgotForm   onBack={() => setView('login')} />}
          {view === 'recovery' && <RecoveryForm onDone={() => navigate('/admin')} />}
        </div>
      </div>
    </div>
  )
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginForm({ onForgot }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <>
      <h1 className="text-white text-xl font-black uppercase tracking-widest mb-1">Admin Login</h1>
      <p className="text-white/30 text-xs mb-8">Southampton Spitfires</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Email</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            required autoComplete="email" className={inputClass} placeholder="you@example.com" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Password</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            required autoComplete="current-password" className={inputClass} placeholder="••••••••" />
        </label>
        {error && (
          <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</p>
        )}
        <button type="submit" disabled={loading}
          className="mt-2 bg-[#00436b] hover:bg-[#005a8f] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase tracking-widest text-sm py-3 rounded-lg transition-colors">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
        <button type="button" onClick={onForgot}
          className="text-white/30 hover:text-white/60 text-xs text-center transition-colors">
          Forgot password?
        </button>
      </form>
    </>
  )
}

// ─── Forgot password ──────────────────────────────────────────────────────────

function ForgotForm({ onBack }) {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/login`,
    })
    if (error) { setError(error.message); setLoading(false) }
    else setSent(true)
  }

  return (
    <>
      <h1 className="text-white text-xl font-black uppercase tracking-widest mb-1">Reset Password</h1>
      <p className="text-white/30 text-xs mb-8">We'll send a reset link to your email.</p>
      {sent ? (
        <div className="text-center py-4">
          <p className="text-white/70 text-sm mb-6">Check your inbox for a password reset link.</p>
          <button onClick={onBack}
            className="text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
            Back to Login
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email" className={inputClass} placeholder="you@example.com" />
          </label>
          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</p>
          )}
          <button type="submit" disabled={loading}
            className="mt-2 bg-[#00436b] hover:bg-[#005a8f] disabled:opacity-50 text-white font-bold uppercase tracking-widest text-sm py-3 rounded-lg transition-colors">
            {loading ? 'Sending…' : 'Send Reset Email'}
          </button>
          <button type="button" onClick={onBack}
            className="text-white/30 hover:text-white/60 text-xs text-center transition-colors">
            Back to Login
          </button>
        </form>
      )}
    </>
  )
}

// ─── Set new password (arrived via recovery email link) ───────────────────────

function RecoveryForm({ onDone }) {
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
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false) }
    else onDone()
  }

  return (
    <>
      <h1 className="text-white text-xl font-black uppercase tracking-widest mb-1">New Password</h1>
      <p className="text-white/30 text-xs mb-8">Enter a new password for your account.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-white/50 text-xs font-bold uppercase tracking-widest">New Password</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            required className={inputClass} placeholder="••••••••" />
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
          {loading ? 'Updating…' : 'Set New Password'}
        </button>
      </form>
    </>
  )
}

const inputClass =
  'bg-[#0a0f1a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00436b] transition-colors'
